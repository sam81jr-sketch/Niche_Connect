const token =
    localStorage.getItem(
        "campuschat_admin_token"
    );


// ==========================================
// CHECK ADMIN LOGIN
// ==========================================

if (!token) {

    window.location.href =
        "/admin/login.html";

}


// ==========================================
// API REQUEST HELPER
// ==========================================

async function adminFetch(
    url,
    options = {}
) {

    options.headers = {

        ...(options.headers || {}),

        "Authorization":
            `Bearer ${token}`,

        "Content-Type":
            "application/json"

    };


    const response =
        await fetch(
            url,
            options
        );


    if (
        response.status === 401 ||
        response.status === 403
    ) {

        logout();

        return null;

    }


    return response;

}


// ==========================================
// LOAD STATISTICS
// ==========================================

async function loadStats() {

    try {

        const response =
            await adminFetch(
                "/api/admin/stats"
            );


        if (!response) return;


        const data =
            await response.json();


        if (!data.success) {

            return;

        }


        const stats =
            data.stats;


        document.getElementById(
            "totalUsers"
        ).textContent =
            stats.totalUsers;


        document.getElementById(
            "totalMessages"
        ).textContent =
            stats.totalMessages;


        document.getElementById(
            "totalReports"
        ).textContent =
            stats.totalReports;


        document.getElementById(
            "bannedUsers"
        ).textContent =
            stats.bannedUsers;


    } catch (error) {

        console.error(
            "Stats error:",
            error
        );

    }

}


// ==========================================
// LOAD USERS
// ==========================================

async function loadUsers() {

    const container =
        document.getElementById(
            "usersContainer"
        );


    container.textContent =
        "Loading users...";


    try {

        const response =
            await adminFetch(
                "/api/admin/users"
            );


        if (!response) return;


        const data =
            await response.json();


        if (!data.success) {

            container.textContent =
                data.message ||
                "Unable to load users.";

            return;

        }


        if (
            !data.users ||
            data.users.length === 0
        ) {

            container.textContent =
                "No users found.";

            return;

        }


        container.innerHTML = "";


        data.users.forEach(
            user => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "user-row";


                const banned =
                    user.bannedUntil &&
                    user.bannedUntil >
                    Date.now();


                row.innerHTML = `

                    <div>

                        <strong>
                            ${escapeHTML(
                                user.username
                            )}
                        </strong>

                        <small>
                            ID: ${user.id}
                        </small>

                        <small>
                            Strikes:
                            ${user.strikes || 0}
                        </small>

                    </div>

                    <div>

                        ${
                            banned

                            ?

                            `
                            <span class="badge">
                                BANNED
                            </span>

                            <button
                                onclick="unbanUser('${user.id}')"
                            >
                                Unban
                            </button>
                            `

                            :

                            `
                            <button
                                onclick="banUser('${user.id}')"
                            >
                                Ban
                            </button>
                            `

                        }

                    </div>

                `;


                container.appendChild(
                    row
                );

            }
        );


    } catch (error) {

        console.error(
            "Users error:",
            error
        );


        container.textContent =
            "Unable to load users.";

    }

}


// ==========================================
// LOAD REPORTS
// ==========================================

async function loadReports() {

    const container =
        document.getElementById(
            "reportsContainer"
        );


    container.textContent =
        "Loading reports...";


    try {

        const response =
            await adminFetch(
                "/api/admin/reports"
            );


        if (!response) return;


        const data =
            await response.json();


        if (!data.success) {

            container.textContent =
                data.message ||
                "Unable to load reports.";

            return;

        }


        if (
            !data.reports ||
            data.reports.length === 0
        ) {

            container.textContent =
                "No reports.";

            return;

        }


        container.innerHTML = "";


        data.reports.forEach(
            report => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "report-row";


                row.innerHTML = `

                    <div>

                        <strong>
                            Report #${report.id}
                        </strong>

                        <p>
                            Reason:
                            ${escapeHTML(
                                report.reason ||
                                "No reason provided"
                            )}
                        </p>

                        <small>
                            Status:
                            ${escapeHTML(
                                report.status ||
                                "pending"
                            )}
                        </small>

                    </div>

                    <div>

                        <button
                            onclick="resolveReport('${report.id}')"
                        >
                            Resolve
                        </button>

                    </div>

                `;


                container.appendChild(
                    row
                );

            }
        );


    } catch (error) {

        console.error(
            "Reports error:",
            error
        );


        container.textContent =
            "Unable to load reports.";

    }

}


// ==========================================
// BAN USER
// ==========================================

async function banUser(
    userId
) {

    const minutes =
        prompt(
            "Ban duration in minutes:"
        );


    if (!minutes) {

        return;

    }


    const duration =
        Number(minutes);


    if (
        !Number.isInteger(duration) ||
        duration < 1
    ) {

        alert(
            "Enter a valid number of minutes."
        );

        return;

    }


    try {

        const response =
            await adminFetch(
                "/api/admin/ban",
                {

                    method: "POST",

                    body:
                        JSON.stringify({

                            userId:
                                userId,

                            minutes:
                                duration

                        })

                }
            );


        if (!response) return;


        const data =
            await response.json();


        alert(
            data.message
        );


        loadUsers();

        loadStats();


    } catch (error) {

        console.error(error);

        alert(
            "Unable to ban user."
        );

    }

}


// ==========================================
// UNBAN USER
// ==========================================

async function unbanUser(
    userId
) {

    try {

        const response =
            await adminFetch(
                "/api/admin/unban",
                {

                    method: "POST",

                    body:
                        JSON.stringify({

                            userId:
                                userId

                        })

                }
            );


        if (!response) return;


        const data =
            await response.json();


        alert(
            data.message
        );


        loadUsers();

        loadStats();


    } catch (error) {

        console.error(error);

        alert(
            "Unable to unban user."
        );

    }

}


// ==========================================
// RESOLVE REPORT
// ==========================================

async function resolveReport(
    reportId
) {

    try {

        const response =
            await adminFetch(
                "/api/admin/report/status",
                {

                    method: "POST",

                    body:
                        JSON.stringify({

                            reportId:
                                reportId,

                            status:
                                "resolved"

                        })

                }
            );


        if (!response) return;


        const data =
            await response.json();


        alert(
            data.message
        );


        loadReports();

        loadStats();


    } catch (error) {

        console.error(error);

        alert(
            "Unable to update report."
        );

    }

}


// ==========================================
// LOGOUT
// ==========================================

function logout() {

    localStorage.removeItem(
        "campuschat_admin_token"
    );


    window.location.href =
        "/admin/login.html";

}


document.getElementById(
    "logoutButton"
).addEventListener(
    "click",
    logout
);


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(value);

    return div.innerHTML;

}


// ==========================================
// INITIAL LOAD
// ==========================================

loadStats();

loadUsers();

loadReports();
