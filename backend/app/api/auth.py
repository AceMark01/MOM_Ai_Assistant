"""Auth endpoints – Google Sheets backed with admin-only user creation and forgot password."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.security import verify_password, create_access_token, get_current_user, hash_password, require_roles
from app.schemas.schemas import UserCreate, UserResponse, Token
from app.services.user_service import UserService
from app.models.models import UserRole

router = APIRouter()


class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.EMPLOYEE
    phone: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    user_id: int
    new_password: str


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await UserService.get_user_by_email(None, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return Token(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    data: AdminUserCreate,
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.CEO))
):
    """Only Admin/CEO can create new user accounts."""
    existing = await UserService.get_user_by_email(None, data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_data = UserCreate(
        name=data.name,
        email=data.email,
        password=data.password,
        role=data.role,
        phone=data.phone,
    )
    user = await UserService.create_user(None, user_data)
    
    # Send welcome email with login credentials
    try:
        from app.notifications.email_service import EmailService, get_base_template
        from app.config import get_settings
        s = get_settings()
        
        content = f"""
            <p style="font-size: 16px; color: #475569; margin: 0 0 16px;">Dear {data.name},</p>
            <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 18px;">
                Your account has been created on the <strong>{s.CLIENT_NAME}</strong> Management System. You can now log in using the credentials below.
            </p>
            <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="font-size: 15px; color: #166534; margin: 0;">
                    <strong>Login URL:</strong> {s.FRONTEND_URL}<br>
                    <strong>Email (Username):</strong> {data.email}<br>
                    <strong>Password:</strong> {data.password}<br><br>
                    Please change your password after your first login.
                </p>
            </div>
            <p style="font-size: 14px; color: #64748b; margin: 0;">If you did not expect this account, please contact your administrator.</p>
        """
        html = get_base_template("Welcome to the Team", content)
        await EmailService.send_email(data.email, f"Welcome to {s.CLIENT_NAME} - Your Login Credentials", html)
    except Exception:
        pass  # Non-critical: user is created even if email fails
    
    return user


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """User requests password reset → email sent to admin."""
    user = await UserService.get_user_by_email(None, data.email)
    if not user:
        # Don't reveal if email exists or not
        return {"message": "If this email is registered, a reset request has been sent to the administrator."}
    
    # Queue email to admin via EmailQueue
    try:
        from app.notifications.email_service import EmailService, get_base_template
        from app.config import get_settings
        settings = get_settings()
        
        admin_email = settings.CLIENT_CS_EMAIL or settings.SMTP_USER
        content = f"""
            <p style="font-size: 16px; color: #475569; margin: 0 0 16px;">Dear Administrator,</p>
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="font-size: 15px; color: #92400e; margin: 0;">
                    <strong>Password Reset Request</strong><br>
                    Employee <strong>{user.name}</strong> ({user.email}) has requested a password reset.
                </p>
            </div>
            <p style="font-size: 15px; color: #334155;">Please reset their password from the User Management panel in the MOM system.</p>
        """
        html = get_base_template("Password Reset Request", content)
        await EmailService.send_email(admin_email, f"Password Reset Request: {user.name}", html)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Failed to send forgot password email: %s", e)
    
    return {"message": "If this email is registered, a reset request has been sent to the administrator."}


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    current_user=Depends(require_roles(UserRole.ADMIN, UserRole.CEO))
):
    """Admin resets a user's password."""
    from app.services.google_sheets_service import SheetsDB
    
    user = await UserService.get_user_by_id(None, data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_hash = hash_password(data.new_password)
    SheetsDB.update_row("Users", data.user_id, {"hashed_password": new_hash})
    
    # Notify user via email
    try:
        from app.notifications.email_service import EmailService, get_base_template
        content = f"""
            <p style="font-size: 16px; color: #475569; margin: 0 0 16px;">Dear {user.name},</p>
            <p style="font-size: 15px; color: #334155; margin: 0 0 16px;">Your password has been reset by the administrator.</p>
            <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="font-size: 15px; color: #166534; margin: 0;">
                    <strong>New Password:</strong> {data.new_password}<br>
                    Please change your password after logging in.
                </p>
            </div>
        """
        html = get_base_template("Password Reset", content)
        await EmailService.send_email(user.email, "Your Password Has Been Reset", html)
    except Exception:
        pass
    
    return {"message": f"Password reset for {user.name}"}
