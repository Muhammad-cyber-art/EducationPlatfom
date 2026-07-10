# Admin Bot - CRM Integrated Telegram Reporting System

## Overview

This is a sophisticated Role-Based Access Control (RBAC) and automated reporting system integrated with the CRM via Telegram bot. The system provides automated daily and monthly reports to admins and super_admins based on their roles and permissions.

## Features

### Authentication & Authorization
- **Phone-based Authentication**: Admins authenticate via phone number verification against the database
- **Role-Based Access Control**: Two distinct roles with different permissions
  - **Admin**: Access to branch-specific reports
  - **Super_Admin**: Access to comprehensive financial reports across all branches
- **Secure Session Management**: Confirmation flow for authentication

### Automated Reporting
- **Daily Branch Reports**: Excel reports sent to admins daily at 8:00 PM
- **Monthly Attendance Archives**: ZIP archives containing daily attendance reports sent on last day of month
- **Monthly Financial Reports**: Comprehensive financial reports sent to super_admins on last day of month

### Manual Report Requests
- Admins can request reports on-demand via bot commands
- Super_admins can request financial reports manually
- Task-based processing with Celery for non-blocking operations

## Architecture

### Components

1. **User Model Extension** (`authenticatsiya/models.py`)
   - Added `telegram_chat_id` field for admin authentication
   - Existing role system (admin, super_admin, mentor)

2. **Report Generator Service** (`reports/report_generator.py`)
   - `ReportGenerator`: Main service class for report generation
   - `ReportDistributor`: Handles file distribution to Telegram users
   - SOLID principles compliant design

3. **Celery Tasks** (`reports/admin_tasks.py`)
   - Scheduled tasks for automated reporting
   - Manual report triggering capabilities
   - Error handling and logging

4. **Admin Bot** (`telegram_bot/management/commands/adminbot.py`)
   - Separate Telegram bot for admin users
   - Phone-based authentication flow
   - Interactive command interface

5. **Celery Beat Configuration** (`config/celery.py`)
   - Scheduled task definitions
   - Timezone configuration
   - Beat schedule setup

## Installation & Setup

### 1. Database Migration

Add the new `telegram_chat_id` field to the User model:

```bash
python manage.py makemigrations authenticatsiya
python manage.py migrate
```

### 2. Environment Variables

Add the following to your `.env` file:

```env
# Admin Bot Token (separate from student bot)
ADMIN_TELEGRAM_BOT_TOKEN=your_admin_bot_token_here

# Existing configuration
TELEGRAM_BOT_TOKEN=your_student_bot_token_here
```

### 3. Dependencies

Ensure all required packages are installed (already in `requirements.txt`):

```
celery
redis
django-celery-beat
openpyxl
python-telegram-bot
```

### 4. Celery Setup

Start Celery worker and beat:

```bash
# Celery Worker
celery -A config worker -l info

# Celery Beat (for scheduled tasks)
celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

### 5. Admin Bot Startup

Start the admin bot:

```bash
python manage.py adminbot
```

## Usage

### For Admins

1. **Authentication**:
   - Open the admin bot in Telegram
   - Send `/start` command
   - Share your phone number (must match database)
   - Confirm your identity

2. **Available Commands**:
   - `/start` - Begin authentication
   - `/help` - Show help message
   - `/report` - Request manual report

3. **Automated Reports**:
   - Daily branch report at 8:00 PM
   - Monthly attendance ZIP on last day of month at 9:00 PM

### For Super Admins

1. **Authentication**: Same as admins
2. **Additional Features**:
   - Monthly financial reports on last day of month at 9:30 PM
   - Access to comprehensive system-wide financial data

## Report Types

### Daily Branch Report
- **Format**: Excel (.xlsx)
- **Content**: Attendance, homework assignments, submission status
- **Recipients**: Admins (branch-specific)
- **Schedule**: Daily at 8:00 PM

### Monthly Attendance Archive
- **Format**: ZIP archive containing daily Excel files
- **Content**: All daily attendance reports for the month
- **Recipients**: Admins (branch-specific)
- **Schedule**: Last day of month at 9:00 PM

### Monthly Financial Report
- **Format**: Excel with multiple sheets
- **Content**:
  - Student payments
  - Employee salaries
  - Other transactions (refunds, utilities)
  - Branch statistics
  - Grand totals
- **Recipients**: Super Admins only
- **Schedule**: Last day of month at 9:30 PM

## Configuration

### Celery Beat Schedule

Edit `config/celery.py` to customize schedules:

```python
app.conf.beat_schedule = {
    'send-daily-reports-to-admins': {
        'task': 'reports.send_daily_reports_to_admins',
        'schedule': crontab(hour=20, minute=0),  # 8:00 PM
    },
    'send-monthly-attendance-to-admins': {
        'task': 'reports.send_monthly_attendance_to_admins',
        'schedule': crontab(hour=21, minute=0, day_of_month='28-31'),
    },
    'send-monthly-financial-to-super-admins': {
        'task': 'reports.send_monthly_financial_to_super_admins',
        'schedule': crontab(hour=21, minute=30, day_of_month='28-31'),
    },
}
```

### Timezone Configuration

Set your timezone in `config/celery.py`:

```python
app.conf.timezone = 'Asia/Tashkent'  # or your preferred timezone
```

## API Endpoints

### Manual Report Triggering

You can trigger reports programmatically via Celery tasks:

```python
from reports.admin_tasks import (
    send_manual_daily_report,
    send_manual_monthly_attendance,
    send_manual_monthly_financial
)

# Daily report for specific admin
send_manual_daily_report.delay(admin_id=1, target_date_str='2024-01-15')

# Monthly attendance for specific admin
send_manual_monthly_attendance.delay(admin_id=1, year=2024, month=1)

# Monthly financial for super admin
send_manual_monthly_financial.delay(super_admin_id=1, year=2024, month=1)
```

## Error Handling

The system includes comprehensive error handling:

1. **Report Generation**: Custom `ReportGenerationError` exceptions
2. **File Distribution**: Retry logic and error logging
3. **Authentication**: Clear error messages for failed authentication
4. **Task Execution**: Detailed logging for debugging

All errors are logged with appropriate severity levels.

## Security Considerations

1. **Phone Verification**: Only authorized phone numbers can access admin functions
2. **Role-Based Access**: Strict separation between admin and super_admin permissions
3. **Branch Isolation**: Admins only see data for their assigned branch
4. **Token Security**: Separate bot tokens for student and admin bots

## Monitoring & Logging

### Log Files

Check logs for:
- Celery worker logs
- Admin bot logs
- Django application logs

### Key Log Messages

- `INFO`: Successful operations
- `WARNING`: Non-critical issues (e.g., missing telegram_chat_id)
- `ERROR`: Failed operations with stack traces

## Troubleshooting

### Common Issues

1. **Bot not starting**:
   - Check `ADMIN_TELEGRAM_BOT_TOKEN` in `.env`
   - Verify token is valid and not expired

2. **Reports not sending**:
   - Check Celery worker is running
   - Verify user has `telegram_chat_id` set
   - Check user has branch assigned (for admins)

3. **Authentication failing**:
   - Verify phone number matches database exactly
   - Check user role is 'admin' or 'super_admin'
   - Ensure user is active (`is_active=True`)

4. **Celery beat not triggering**:
   - Verify beat scheduler is running
   - Check timezone configuration
   - Review beat schedule configuration

## Development

### Adding New Report Types

1. Add report generation method to `ReportGenerator` class
2. Add distribution method to `ReportDistributor` class
3. Create Celery task in `admin_tasks.py`
4. Add beat schedule in `config/celery.py`
5. Update bot commands if needed

### Testing

Test the system in development:

```bash
# Test manual report
python manage.py shell
>>> from reports.admin_tasks import send_manual_daily_report
>>> send_manual_daily_report.delay(admin_id=1)

# Test bot locally
python manage.py adminbot
```

## Production Deployment

### Checklist

- [ ] Set up Redis for Celery broker
- [ ] Configure Celery beat with database scheduler
- [ ] Set up process managers (supervisor/systemd)
- [ ] Configure log rotation
- [ ] Set up monitoring (Sentry, etc.)
- [ ] Test failover scenarios
- [ ] Document backup procedures

### Process Management

Example systemd service files:

**Celery Worker**:
```ini
[Unit]
Description=Celery Worker
After=network.target

[Service]
Type=forking
User=www-data
Group=www-data
WorkingDirectory=/path/to/project
ExecStart=/path/to/venv/bin/celery -A config worker -l info
Restart=always

[Install]
WantedBy=multi-user.target
```

**Celery Beat**:
```ini
[Unit]
Description=Celery Beat
After=network.target

[Service]
Type=forking
User=www-data
Group=www-data
WorkingDirectory=/path/to/project
ExecStart=/path/to/venv/bin/celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
Restart=always

[Install]
WantedBy=multi-user.target
```

**Admin Bot**:
```ini
[Unit]
Description=Admin Telegram Bot
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/path/to/project
ExecStart=/path/to/venv/bin/python manage.py adminbot
Restart=always

[Install]
WantedBy=multi-user.target
```

## Support

For issues or questions:
1. Check logs for error messages
2. Review this documentation
3. Contact development team

## License

Proprietary - All rights reserved
