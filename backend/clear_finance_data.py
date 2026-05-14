import os
import django

# Django muhitini sozlash
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from finance.models import Payment, EmployeePayment, EmployeeAdvance, FinanceTransaction
from django.db import transaction

def clear_all_finance_data():
    print("Moliya ma'lumotlarini tozalash boshlandi...")
    
    try:
        with transaction.atomic():
            # 1. Student Payments
            p_count = Payment.objects.all().count()
            Payment.objects.all().delete()
            print(f"-> {p_count} ta o'quvchi to'lovi o'chirildi.")
            
            # 2. Employee Payments
            ep_count = EmployeePayment.objects.all().count()
            EmployeePayment.objects.all().delete()
            print(f"-> {ep_count} ta xodim oylik ma'lumoti o'chirildi.")
            
            # 3. Employee Advances
            ea_count = EmployeeAdvance.objects.all().count()
            EmployeeAdvance.objects.all().delete()
            print(f"-> {ea_count} ta avans ma'lumoti o'chirildi.")
            
            # 4. Finance Transactions (Ledger)
            ft_count = FinanceTransaction.objects.all().count()
            FinanceTransaction.objects.all().delete()
            print(f"-> {ft_count} ta kassa (ledger) amaliyoti o'chirildi.")
            
        print("\n[MUVAFFAQIYATLI] Barcha moliyaviy ma'lumotlar tozalandi.")
        print("Endi tizimni yangi mantiq bilan noldan boshlashingiz mumkin.")
        
    except Exception as e:
        print(f"\n[XATOLIK] Tozalashda xatolik yuz berdi: {str(e)}")

if __name__ == "__main__":
    confirm = input("DIQQAT! Barcha moliyaviy ma'lumotlar o'chiriladi. Rozimisiz? (yes/no): ")
    if confirm.lower() == 'yes':
        clear_all_finance_data()
    else:
        print("Amal bekor qilindi.")
