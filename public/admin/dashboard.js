// ==========================================
// ADMIN TOKEN
// ==========================================

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

    throw new Error(
        "Admin authentication required."
    );

}


// ==========================================
// ADMIN API
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
            stats.totalUsers || 0;


        document.getElementById(
            "totalMessages"
        ).textContent =
            stats.totalMessages || 0;


        document.getElementById(
            "totalRooms"
        ).textContent =
            stats.totalRooms || 0;


        document.getElementById(
            "activeRooms"
        ).textContent =
            stats.activeRooms || 0;


        document.getElementById(
            "totalReports"
        ).textContent =
            stats.totalReports || 0;


        document.getElementById(
            "bannedUsers"
        ).textContent =
            stats.bannedUsers || 0;


    } catch (error) {

        console.error(
            "Stats error:",
            error
        );

    }

}


// ==========================================
// LOAD ROOMS
// ==========================================

async function loadRooms() {

    const container =
        document.getElementById(
            "roomsContainer"
        );


    container.textContent =
        "Loading rooms...";


    try {

        const response =
            await adminFetch(
                "/api/admin/rooms"
            );


        if (!response) return;


        const data =
            await response.json();


        if (!data.success) {

            container.textContent =
                data.message ||
                "Unable to load rooms.";

            return;

        }


        if (
            !data.rooms ||
            data.rooms.length === 0
        ) {

            container.textContent =
                "No private chat rooms.";

            return;

        }


        container.innerHTML = "";


        data.rooms.forEach(
            room => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "room-row";


                const status =
                    room.active
                        ? "🟢 Active"
                        : "⚪ Ended";


                const callStatus =
                    room.videoCallActive
                        ? "📹 Call active"
                        : "";


                row.innerHTML = `

                    <div>

                        <strong>
                            ${escapeHTML(
                                room.user1.username
                            )}
                            ↔
                            ${escapeHTML(
                                room.user2.username
                            )}
                        </strong>

                        <small>
                            Room:
                            ${escapeHTML(room.id)}
                        </small>

                        <small>
                            ${status}
                            ${callStatus
                                ? " • " + callStatus
                                : ""}
                        </small>

                        <small>
                            💬
                            ${room.messageCount}
                            messages
                        </small>

                    </div>


                    <div>

                        <button
                            onclick="openChat('${escapeAttribute(room.id)}')"
                        >
                            View Chat
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
            "Rooms error:",
            error
        );


        container.textContent =
            "Unable to load rooms.";

    }

}


// ==========================================
// OPEN CHAT
// ==========================================

async function openChat(
    roomId
) {

    const modal =
        document.getElementById(
            "chatModal"
        );


    const messagesContainer =
        document.getElementById(
            "chatMessages"
        );


    modal.style.display =
        "flex";


    messagesContainer.innerHTML = `

        <div class="loading">
            Loading private messages...
        </div>

    `;


    try {

        const response =
            await adminFetch(
                "/api/admin/rooms/" +
                encodeURIComponent(roomId) +
                "/messages"
            );


        if (!response) return;


        const data =
            await response.json();


        if (!data.success) {

            messagesContainer.innerHTML = `

                <div class="loading">
                    ${escapeHTML(
                        data.message ||
                        "Unable to load messages."
                    )}
                </div>

            `;

            return;

        }


        const users =
            data.users || [];


        document.getElementById(
            "modalTitle"
        ).textContent =

            users.length >= 2

                ? users[0].username +
                  " ↔ " +
                  users[1].username

                : "Private Chat";


        messagesContainer.innerHTML = "";


        if (
            !data.messages ||
            data.messages.length === 0
        ) {

            messagesContainer.innerHTML = `

                <div class="loading">
                    No messages in this room.
                </div>

            `;

            return;

        }


        data.messages.forEach(
            message => {

                const element =
                    document.createElement(
                        "div"
                    );


                const isFirstUser =
                    users[0] &&
                    String(
                        message.userId
                    ) ===
                    String(
                        users[0].id
                    );


                element.className =
                    "admin-message";


                if (isFirstUser) {

                    element.classList.add(
                        "left"
                    );

                } else {

                    element.classList.add(
                        "right"
                    );

                }


                const time =
                    message.time
                        ? new Date(
                            message.time
                          ).toLocaleString()
                        : "";


                element.innerHTML = `

                    <div class="message-user">

                        ${escapeHTML(
                            message.username ||
                            "User"
                        )}

                    </div>


                    <div class="message-text">

                        ${escapeHTML(
                            message.message ||
                            ""
                        )}

                    </div>


                    <div class="message-time">

                        ${escapeHTML(
                            time
                        )}

                    </div>

                `;


                messagesContainer.appendChild(
                    element
                );

            }
        );


        messagesContainer.scrollTop =
            messagesContainer.scrollHeight;


    } catch (error) {

        console.error(
            "Open chat error:",
            error
        );


        messagesContainer.innerHTML = `

            <div class="loading">
                Unable to load chat.
            </div>

        `;

    }

}


// ==========================================
// CLOSE CHAT
// ==========================================

function closeChat() {

    document.getElementById(
        "chatModal"
    ).style.display =
        "none";

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
                            ID:
                            ${escapeHTML(
                                user.id
                            )}
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
                                onclick="unbanUser('${escapeAttribute(user.id)}')"
                            >
                                Unban
                            </button>

                            `

                            :

                            `

                            <button
                                onclick="banUser('${escapeAttribute(user.id)}')"
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
                            Report #${escapeHTML(
                                report.id
                            )}
                        </strong>

                        <p>
                            Reason:
                            ${escapeHTML(
                                report.reason ||
                                "No reason"
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


                    <button
                        onclick="resolveReport('${escapeAttribute(report.id)}')"
                    >
                        Resolve
                    </button>

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
// BAN
// ==========================================

async function banUser(
    userId
) {

    const minutes =
        prompt(
            "Ban duration in minutes:"
        );


    if (!minutes) return;


    const duration =
        Number(minutes);


    if (
        !Number.isInteger(duration) ||
        duration < 1 ||
        duration > 43200
    ) {

        alert(
            "Enter a value between 1 and 43200."
        );

        return;

    }


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
        data.message ||
        "Ban completed."
    );


    loadUsers();
    loadStats();

}


// ==========================================
// UNBAN
// ==========================================

async function unbanUser(
    userId
) {

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
        data.message ||
        "User unbanned."
    );


    loadUsers();
    loadStats();

}


// ==========================================
// RESOLVE REPORT
// ==========================================

async function resolveReport(
    reportId
) {

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
        data.message ||
        "Report updated."
    );


    loadReports();
    loadStats();

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
        value == null
            ? ""
            : String(value);


    return div.innerHTML;

}


function escapeAttribute(
    value
) {

    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}


// ==========================================
// INITIAL LOAD
// ==========================================

loadStats();

loadRooms();

loadUsers();

loadReports();


// ==========================================
// AUTO REFRESH
// ==========================================

setInterval(
    () => {

        loadStats();
        loadRooms();

    },
    10000
);


// ==========================================
// EXPORT
// ==========================================

window.loadRooms =
    loadRooms;

window.openChat =
    openChat;

window.closeChat =
    closeChat;

window.loadUsers =
    loadUsers;

window.loadReports =
    loadReports;

window.banUser =
    banUser;

window.unbanUser =
    unbanUser;

window.resolveReport =
    resolveReport;
