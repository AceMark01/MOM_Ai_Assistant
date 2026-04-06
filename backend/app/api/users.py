"""User management endpoints – Google Sheets backed."""

from fastapi import APIRouter, HTTPException

from app.schemas.schemas import UserResponse, UserUpdate
from app.services.user_service import UserService

router = APIRouter()


@router.get("/", response_model=list[UserResponse])
async def list_users(skip: int = 0, limit: int = 100):
    return await UserService.list_users(None, skip, limit)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int):
    user = await UserService.get_user_by_id(None, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: int, data: UserUpdate):
    user = await UserService.update_user(None, user_id, data)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/{user_id}")
async def delete_user(user_id: int):
    deleted = await UserService.delete_user(None, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")
    return {"detail": "User deleted"}
