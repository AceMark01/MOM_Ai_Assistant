"""Dashboard / analytics service – reads from Google Sheets."""

from datetime import date, datetime
import calendar
import logging

from app.services.google_sheets_service import SheetsDB, _to_int
from app.services.meeting_service import (
    MeetingService, _row_to_meeting_obj, _row_to_task,
    _parse_date, _parse_time, _load_meeting_relations, DotDict,
)
from app.services.task_service import TaskService
from app.services.user_service import UserService

from app.schemas.schemas import (
    DashboardStats, TaskStatusDistribution, MeetingTrend,
    MeetingListResponse, TaskResponse, AnalyticsResponse, MeetingResponse,
)

logger = logging.getLogger(__name__)


class DashboardService:

    @staticmethod
    async def get_dashboard(db) -> AnalyticsResponse:
        total_meetings_reg = await MeetingService.count_meetings(db)
        total_meetings_br = SheetsDB.count("BR_Meetings")
        
        status_counts_reg = await TaskService.count_by_status(db)
        # Manually count BR tasks
        br_tasks = SheetsDB.get_all("BR_Tasks")
        status_counts_br = {"Pending": 0, "In Progress": 0, "Completed": 0}
        for t in br_tasks:
            s = t.get("status", "Pending")
            if s in status_counts_br:
                status_counts_br[s] += 1
            else:
                status_counts_br[s] = 1
        
        # Merge counts
        status_counts = {
            s: status_counts_reg.get(s, 0) + status_counts_br.get(s, 0)
            for s in ["Pending", "In Progress", "Completed"]
        }

        total_tasks = sum(status_counts.values())
        pending = status_counts.get("Pending", 0)
        in_progress = status_counts.get("In Progress", 0)
        completed = status_counts.get("Completed", 0)

        overdue_list_reg = await TaskService.overdue_tasks(db)
        # TODO: Add BR overdue if needed, but for now just reg
        
        upcoming_reg = await MeetingService.upcoming_meetings(db)
        upcoming_br_list = [m for m in SheetsDB.get_all("BR_Meetings") if m.get("status") in ["Scheduled", "Rescheduled", "Processing"]]
        
        total_users = await UserService.count_users(db)

        # Recent meetings (merge and take top 5)
        recent_reg = await MeetingService.list_meetings(db, limit=5)
        from app.services.br_meeting_service import BRService
        recent_br = await BRService.list_brs(db, limit=5)
        
        combined_recent = []
        for m in recent_reg:
            combined_recent.append(MeetingListResponse(
                id=m.id, title=m.title, organization=m.organization,
                date=m.date, time=m.time, venue=m.venue, created_at=m.created_at,
                task_count=len(m.tasks) if hasattr(m, 'tasks') and m.tasks else 0,
                status=m.status, pdf_link=m.pdf_link, recording_link=m.recording_link,
                source="Regular"
            ))
        for m in recent_br:
            combined_recent.append(MeetingListResponse(
                id=m.id, title=m.title, organization=m.organization,
                date=m.date, time=m.time, venue=m.venue, created_at=m.created_at,
                task_count=len(m.tasks) if hasattr(m, 'tasks') and m.tasks else 0,
                status=m.status, pdf_link=m.pdf_link, recording_link=m.recording_link,
                source="BR"
            ))
        combined_recent.sort(key=lambda x: x.created_at, reverse=True)
        recent_resp = combined_recent[:5]

        # Task distribution
        distribution = [
            TaskStatusDistribution(status=s, count=c) for s, c in status_counts.items()
        ]

        # Meeting trends (last 6 months)
        all_meetings = SheetsDB.get_all("Meetings") + SheetsDB.get_all("BR_Meetings")
        trends = []
        today = date.today()
        for i in range(5, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            month_count = 0
            for mtg in all_meetings:
                d = _parse_date(mtg.get("date"))
                if d and d.month == m and d.year == y:
                    month_count += 1
            month_name = f"{calendar.month_abbr[m]} {y}"
            trends.append(MeetingTrend(month=month_name, count=month_count))

        overdue_resp = []
        for t in overdue_list_reg:
            overdue_resp.append(TaskResponse(
                id=t.id, meeting_id=t.meeting_id, title=t.title,
                description=t.description, responsible_person=t.responsible_person,
                responsible_email=t.responsible_email, deadline=t.deadline,
                status=t.status, created_at=t.created_at,
            ))

        # Nearest upcoming and last meeting logic
        today_date = date.today()
        time_now = datetime.now().time()
        
        def find_nearest_and_last(meetings):
            nearest = None
            last = None
            for mtg in meetings:
                d = _parse_date(mtg.get("date"))
                t = _parse_time(mtg.get("time"))
                if d:
                    if d > today_date or (d == today_date and t and t >= time_now):
                        if nearest is None:
                            nearest = mtg
                        else:
                            nd = _parse_date(nearest.get("date"))
                            nt = _parse_time(nearest.get("time"))
                            if d < nd or (d == nd and t and nt and t < nt):
                                nearest = mtg
                    elif d < today_date or (d == today_date and t and t < time_now):
                        if last is None:
                            last = mtg
                        else:
                            ld = _parse_date(last.get("date"))
                            lt = _parse_time(last.get("time"))
                            if d > ld or (d == ld and t and lt and t > lt):
                                last = mtg
            return nearest, last

        nearest_reg, last_reg = find_nearest_and_last(SheetsDB.get_all("Meetings"))
        nearest_br, last_br = find_nearest_and_last(SheetsDB.get_all("BR_Meetings"))

        async def to_resp(mtg, is_br=False):
            if not mtg: return None
            mid = _to_int(str(mtg.get("id", "")))
            if not mid: return None
            if is_br:
                m_obj = await BRService.get_br(db, mid)
            else:
                m_obj = await MeetingService.get_meeting(db, mid)
            return _meeting_obj_to_response(m_obj) if m_obj else None

        return AnalyticsResponse(
            stats=DashboardStats(
                total_meetings=total_meetings_reg + total_meetings_br,
                total_tasks=total_tasks,
                pending_tasks=pending,
                in_progress_tasks=in_progress,
                completed_tasks=completed,
                overdue_tasks=len(overdue_list_reg),
                upcoming_meetings=len(upcoming_reg) + len(upcoming_br_list),
                total_users=total_users,
            ),
            task_distribution=distribution,
            meeting_trends=trends,
            recent_meetings=recent_resp,
            overdue_tasks=overdue_resp,
            nearest_upcoming_meeting=await to_resp(nearest_reg),
            last_meeting=await to_resp(last_reg),
            nearest_upcoming_br=await to_resp(nearest_br, is_br=True),
            last_br=await to_resp(last_br, is_br=True),
        )


def _meeting_obj_to_response(m) -> MeetingResponse:
    """Convert a DotDict meeting object to MeetingResponse schema."""
    from app.schemas.schemas import (
        AttendeeResponse, AgendaItemResponse, DiscussionResponse,
        TaskResponse as TR, NextMeetingResponse, FileResponse,
    )

    attendees_resp = [
        AttendeeResponse(
            id=a.id, meeting_id=a.meeting_id, user_name=a.user_name,
            email=a.email, designation=a.designation, unique_id=getattr(a, 'unique_id', None),
            whatsapp_number=a.whatsapp_number, remarks=a.remarks,
            attendance_status=a.attendance_status,
        ) for a in (m.attendees or [])
    ]
    agenda_resp = [
        AgendaItemResponse(
            id=a.id, meeting_id=a.meeting_id, topic=a.topic, description=a.description,
        ) for a in (m.agenda_items or [])
    ]
    disc_resp = None
    if m.discussion:
        disc_resp = DiscussionResponse(
            id=m.discussion.id, meeting_id=m.discussion.meeting_id,
            summary_text=m.discussion.summary_text,
        )
    tasks_resp = [
        TR(
            id=t.id, meeting_id=t.meeting_id, title=t.title,
            description=t.description, responsible_person=t.responsible_person,
            responsible_email=t.responsible_email, deadline=t.deadline,
            status=t.status, created_at=t.created_at,
        ) for t in (m.tasks or [])
    ]
    nm_resp = None
    if m.next_meeting:
        nm_resp = NextMeetingResponse(
            id=m.next_meeting.id, meeting_id=m.next_meeting.meeting_id,
            next_date=m.next_meeting.next_date, next_time=m.next_meeting.next_time,
        )
    
    files_resp = [
        FileResponse(
            id=f.id, meeting_id=f.meeting_id, file_path=f.file_path,
            file_type=f.file_type, uploaded_at=f.uploaded_at,
        ) for f in (getattr(m, 'supporting_documents', []) or [])
    ]

    return MeetingResponse(
        id=m.id, title=m.title, organization=m.organization,
        meeting_type=m.meeting_type, meeting_mode=m.meeting_mode,
        date=m.date, time=m.time, venue=m.venue, hosted_by=m.hosted_by,
        file_path=m.file_path, created_by=m.created_by, created_at=m.created_at,
        attendees=attendees_resp, agenda_items=agenda_resp,
        discussion=disc_resp, tasks=tasks_resp, next_meeting=nm_resp,
        status=m.status,
        pdf_link=getattr(m, 'pdf_link', None),
        drive_file_id=getattr(m, 'drive_file_id', None),
        drive_folder_id=getattr(m, 'drive_folder_id', None),
        recording_link=getattr(m, 'recording_link', None),
        drive_recording_id=getattr(m, 'drive_recording_id', None),
        drive_transcript_id=getattr(m, 'drive_transcript_id', None),
        ai_summary_link=getattr(m, 'ai_summary_link', None),
        supporting_documents=files_resp
    )
