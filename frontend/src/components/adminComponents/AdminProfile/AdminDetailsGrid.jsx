import React from"react";
import { Phone, Calendar, Building2, Shield } from"lucide-react";
import ProfileItem from"./ProfileItem";

const AdminDetailsGrid = ({ admin }) => {
 return (
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <ProfileItem icon={<Phone />} label="Telefon Raqam" value={admin.phone_number ||"---"} color="text-emerald-400" />
 <ProfileItem icon={<Calendar />} label="Qabul Sanasi" value={admin.date_joined ? new Date(admin.date_joined).toLocaleDateString() :'---'} color="text-blue-400" />
 <ProfileItem icon={<Building2 />} label="Asosiy Filial" value={admin.branch?.name ||"Markaz"} color="text-amber-400" />
 <ProfileItem icon={<Shield />} label="Ruxsat Darajasi" value={admin.role} color="text-purple-400" />
 </div>
 );
};

export default AdminDetailsGrid;
