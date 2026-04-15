// admin.js - Logic cho trang Tổng Quan (Dashboard)
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
});

async function loadDashboardStats() {
    try {
        // Load users
        const usersRes = await apiFetchAuth('/api/admin/users', { method: 'GET' });
        const usersData = await usersRes.json();
        if (usersRes.ok && usersData.success) {
            const users = usersData.data || [];
            document.getElementById('stat-users').textContent = users.length;
            document.getElementById('stat-candidates').textContent = users.filter(u => u.role === 'Candidate').length;
            document.getElementById('stat-pending-users').textContent = users.filter(u => u.isApproved === false).length;
        }
    } catch (e) {
        console.error('Lỗi load users stats:', e);
    }

    try {
        // Load jobs
        const jobsRes = await apiFetchAuth('/api/admin/jobs', { method: 'GET' });
        const jobsData = await jobsRes.json();
        if (jobsRes.ok && jobsData.success) {
            const jobs = jobsData.data || [];
            document.getElementById('stat-jobs').textContent = jobs.length;
            document.getElementById('stat-pending-jobs').textContent = jobs.filter(j => !j.isApproved).length;
        }
    } catch (e) {
        console.error('Lỗi load jobs stats:', e);
    }

    try {
        // Load companies
        const companiesRes = await apiFetchAuth('/api/admin/companies', { method: 'GET' });
        const companiesData = await companiesRes.json();
        if (companiesRes.ok && companiesData.success) {
            const companies = companiesData.data || [];
            document.getElementById('stat-companies').textContent = companies.length;
        }
    } catch (e) {
        console.error('Lỗi load companies stats:', e);
    }
}
