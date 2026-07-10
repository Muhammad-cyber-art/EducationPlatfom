import os
import sys

# Delete adminbot.py
adminbot_path = r'c:\Users\Lenovo\Desktop\My Project\EducationPlatfom\backend\telegram_bot\management\commands\adminbot.py'
if os.path.exists(adminbot_path):
    os.remove(adminbot_path)
    print(f'✅ Adminbot.py fayli o\'chirildi: {adminbot_path}')
else:
    print(f'ℹ️ Fayl allaqachon o\'chirilgan yoki mavjud emas: {adminbot_path}')

# Delete delete_adminbot.py
delete_script_path = r'c:\Users\Lenovo\Desktop\My Project\EducationPlatfom\backend\delete_adminbot.py'
if os.path.exists(delete_script_path):
    os.remove(delete_script_path)
    print(f'✅ delete_adminbot.py fayli o\'chirildi: {delete_script_path}')

# Delete this script itself
cleanup_path = r'c:\Users\Lenovo\Desktop\My Project\EducationPlatfom\backend\cleanup.py'
os.remove(cleanup_path)
print(f'✅ cleanup.py fayli o\'chirildi: {cleanup_path}')

print('\n🎉 Tozalash tugadi!')
