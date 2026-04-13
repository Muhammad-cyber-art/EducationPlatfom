import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import PreApp from "./preApp";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <PreApp />
    </>
  );
}

export default App;
// {/* <Routes>
//   {/* 1. ODDDIY ADMIN YO'LLARI (Branch ID URLda YO'Q) */}
//   {/* Backend tokendan qaysi filialligini biladi */}
//   <Route path="/admin" element={<AdminLayout />}>
//       <Route index element={<AdminDashboard />} />         {/* /admin */}
//       <Route path="mentors" element={<MentorsPage />} />   {/* /admin/mentors */}
//       <Route path="groups" element={<GroupsPage />} />     {/* /admin/groups */}
//       {/* Bu sahifalarning hammasi Contextdan user.branch.name ni olib ekranga chiqaradi */}
//   </Route>

//   {/* 2. SUPER ADMIN YO'LLARI (Branch ID URLda BOR) */}
//   {/* Chunki u ko'p filiallar orasida sakrab yuradi */}
//   <Route path="/super_admin" element={<SuperAdminLayout />}>

//       {/* A. Global ko'rinish (Filial tanlash oynasi) */}
//       <Route index element={<AllBranchesList />} />

//       {/* B. Konkret Filial ichi (Dynamic Route) */}
//       {/* Bu yerda ID bo'lishi shart, chunki Super Admin tanladi */}
//       <Route path="branch/:branchId" element={<BranchDashboardLayout />}>
//            <Route index element={<BranchStats />} />       {/* /super_admin/branch/1 */}
//            <Route path="mentors" element={<MentorsPage />} /> {/* /super_admin/branch/1/mentors */}
//            <Route path="groups" element={<GroupsPage />} />
//       </Route>
//   </Route>
// </Routes> */}

// Ha, xuddi shunday! 100% to‘g‘ri tushundingiz.
// Sizning /admin yo‘nalishidagi sahifalaringizda (Mentors, Groups, Students) ma’lumotlar Backend tomonidan, token ichidagi ma’lumotga qarab avtomatik filtrlanadi.
// Jarayon aynan mana bunday ishlaydi:
// Frontend So‘rovi:
// Admin "Mentorlar" sahifasiga kirganda, Frontend Backendga shunday oddiy so‘rov yuboradi:
// GET /api/mentors/
// (E'tibor bering: url da hech qanday ID yo‘q)
// Backend Tekshiruvi (Sehr shu yerda):
// Backend kelgan so‘rovdagi Tokenni tekshiradi.
// Tokendan aniqlaydi: "Bu so‘rovni Admin Bobur yubordi. Bobur 'Chilonzor' filialiga (ID: 1) tegishli."
// Filtrlash:
// Backend bazadan ma'lumot olayotganda o‘zi shart qo‘shadi:
// "Menga barcha mentorlarni emas, faqat branch_id = 1 bo‘lgan mentorlarni olib ber."
// Javob:
// Frontendga faqat shu filialga tegishli ro‘yxat qaytib keladi.
// Bu Frontendchi (Siz) uchun nimani anglatadi?
// Bu siz uchun juda katta qulaylik degani:
// Kod o‘zgarmaydi: Siz Admin sahifasidagi axios.get('/mentors') kodiga umuman tegmaysiz. U oldin qanday ishlagan bo‘lsa, shunday ishlayveradi.
// Xavfsizlik: Admin URL orqali boshqa filial ID sini yozib, ma'lumot o‘g‘irlay olmaydi (chunki backend URL ga emas, tokenga ishonadi).
// Mantiq: Frontendda "Admin qaysi filialda ekan?" deb bosh qotirib, filter funksiyalari yozib o‘tirmaysiz. Sizga backend tayyor, tozalangan "tovoq"da ma'lumot uzatadi.
// Xulosa: Admin uchun branch_id ni saqlash yoki yuborish haqida o‘ylamang. Bu backendning vazifasi. Siz faqat Super Admin uchun branch_id bilan ishlashni (params orqali yuborishni) qo‘shsangiz bo‘ldi.

//  ===================================== NEW PART ===========================================

// xullas arxitektura mana bunday bo'ladi,groups ichida uyga vazifa button bo'ladi, shu bosilganda forma chiqadi
// , uyga vazifa qo'shish uchun ,formada title va dexcription bo'ladi , backenda esa mentor_id group_id created_date 
// kabi malumotlar bo'ladi, uyga vazifa yaratilgach uyga vazifa title i groupDetails sahifasiga keladi , 
// va uni ustiga bosganda alohida homework/id sahifasi ochiladi , unda esa shu guruh o'quvchilari ro'yxati 
// bo'ladi , mentor uyga vazifa topshirgan o'quvchiga ptichka belgilaydi (checkbox) , va har bir ptichka bosilgan 
// zaxoti backendga yoziladimi yoki hammasi bo'lgach bosiladimi , qaysi biri yaxshi , o'z fikringda yozib qoldir,
//  davom etamiz : xullas , ptichke belgilangan o'quvchilar yashil rangda bo'ladi, backenda esa har bir yaratilgan
//  fazifa title va uni kim topshirgan yoki yo'q bularning hammasi malum bir vaqt saqlanadi va exe faylga yozilib 
// mentor ga taqdim qilinadi (bularni sal keynroq ishlaymiz),mentor hech qanday feedback bildirmaydi, baholash 
// umuman bo'lmaydi . Endi Davomat , davomat huquqi admin da bo'ladi , har bir o'quvchi harkun belgilanadi ,
//  aytgancha , homeworkda ham attendance da ham behosdan boshqa o'quvchi belgilanib ketsa uni qaytarib olib 
// bilishi kerak , darhol bckendga yozilib ketishi kerak emas, va bir kunlik davomat shu kungi sana bilan 
// backendga yozilishi kerak , 23 : 59 dan keyn barcha o'quvchilar holati false (kelmagan ) ga o'zgarishi kerak
