import { MessageSquare, Activity, Building2 } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie as RechartsPie, Cell as RechartsCell, BarChart as RechartsBarChart, Bar as RechartsBar, XAxis as RechartsXAxis, YAxis as RechartsYAxis, CartesianGrid as RechartsCartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer as RechartsResponsiveContainer } from 'recharts';

export const BotConnectionsChart = ({ botStats }) => {
    const data = [
        { name: 'Ulangan', value: botStats?.total_bot_users || 0, color: '#b8860b' },
        { name: 'Ulanmagan', value: botStats?.unregistered_students || 0, color: '#22c55e' },
    ];

    return (
        <div className="lux-card p-4">
            <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={18} className="text-[var(--gold)]" />
                <h3 className="text-xs font-black text-[var(--text-primary)] capitalize tracking-widest">Bot Ulanmalari</h3>
            </div>
            <div className="h-48">
                <RechartsResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                        <RechartsPie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <RechartsCell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </RechartsPie>
                        <RechartsTooltip 
                            contentStyle={{ 
                                backgroundColor: 'var(--bg-void)', 
                                border: '1px solid var(--border-glass)',
                                borderRadius: '8px',
                                fontSize: '10px'
                            }} 
                        />
                    </RechartsPieChart>
                </RechartsResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
                {data.map((item, index) => (
                    <div key={index} className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[8px] font-black text-[var(--text-muted)]">{item.name}: {item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const AbsenteesChart = ({ stats }) => {
    const data = [
        { name: 'Keldi', value: (stats?.attendance_today?.total || 0) - (stats?.attendance_today?.absent || 0) },
        { name: 'Kelmadi', value: stats?.attendance_today?.absent || 0 },
    ];

    return (
        <div className="lux-card p-4">
            <div className="flex items-center gap-2 mb-4">
                <Activity size={18} className="text-red-500" />
                <h3 className="text-xs font-black text-[var(--text-primary)] capitalize tracking-widest">Bugungi Davomat</h3>
            </div>
            <div className="h-48">
                <RechartsResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                        <RechartsPie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            <RechartsCell fill="#22c55e" />
                            <RechartsCell fill="#ef4444" />
                        </RechartsPie>
                        <RechartsTooltip 
                            contentStyle={{ 
                                backgroundColor: 'var(--bg-void)', 
                                border: '1px solid var(--border-glass)',
                                borderRadius: '8px',
                                fontSize: '10px'
                            }} 
                        />
                    </RechartsPieChart>
                </RechartsResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[8px] font-black text-[var(--text-muted)]">Keldi: {data[0].value}</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-[8px] font-black text-[var(--text-muted)]">Kelmadi: {data[1].value}</span>
                </div>
            </div>
        </div>
    );
};

export const GroupsAttendanceChart = ({ groupsData }) => {
    const groupsArray = Array.isArray(groupsData) 
        ? groupsData 
        : groupsData?.results 
        ? groupsData.results 
        : [];
    
    const data = groupsArray.map(group => ({
        name: group.name?.substring(0, 10) || 'Guruh',
        students: group.students_count || 0,
    }));

    return (
        <div className="lux-card p-4">
            <div className="flex items-center gap-2 mb-4">
                <Building2 size={18} className="text-[var(--gold)]" />
                <h3 className="text-xs font-black text-[var(--text-primary)] capitalize tracking-widest">Guruhlar Statistikasi</h3>
            </div>
            <div className="h-48">
                <RechartsResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={data.slice(0, 8)}>
                        <RechartsCartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" />
                        <RechartsXAxis 
                            dataKey="name" 
                            tick={{ fontSize: 8, fill: 'var(--text-muted)' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <RechartsYAxis 
                            tick={{ fontSize: 8, fill: 'var(--text-muted)' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <RechartsTooltip 
                            contentStyle={{ 
                                backgroundColor: 'var(--bg-void)', 
                                border: '1px solid var(--border-glass)',
                                borderRadius: '8px',
                                fontSize: '10px'
                            }} 
                        />
                        <RechartsBar dataKey="students" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                </RechartsResponsiveContainer>
            </div>
        </div>
    );
};
