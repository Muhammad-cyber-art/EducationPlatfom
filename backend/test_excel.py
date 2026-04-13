import openpyxl
wb = openpyxl.Workbook()
ws = wb.active
ws['A1'] = 'Test'
wb.save('test.xlsx')
print("Excel test PASSED")
