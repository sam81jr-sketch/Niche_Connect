// ==========================================
// NICHE CONNECT - CHAT.JS
// ==========================================


// ==========================================
// LOGIN
// ==========================================

const token =
    localStorage.getItem("campuschat_token");

const savedUser =
    localStorage.getItem("campuschat_user");

if (!token || !savedUser) {

    window.location.href = "/login.html";

    throw new Error(
        "User is not logged in."
    );
}


let user;

try {

    user =
        JSON.parse(savedUser);

} catch (error) {

    localStorage.removeItem(
        "campuschat_user"
    );

    window.location.href =
        "/login.html";

    throw error;
}


// ==========================================
// USERNAME
// ==========================================

const myUsername =
    user.username || "User";


// ==========================================
// SOCKET.IO
// ==========================================

const socket = io({

    auth: {
        token: token
    }

});


// ==========================================
// CURRENT PARTNER
// ==========================================

let currentPartner = null;

let connectedToPartner = false;


// ==========================================
// PARTNER STORAGE
// ==========================================

function savePartner(partner) {

    if (!partner) {

        sessionStorage.removeItem(
            "campuschat_partner"
        );

        window.currentPartnerUserId =
            null;

        return;
    }


    sessionStorage.setItem(
        "campuschat_partner",
        JSON.stringify(partner)
    );


    window.currentPartnerUserId =
        partner.id;
}


function clearPartner() {

    currentPartner =
        null;

    connectedToPartner =
        false;


    sessionStorage.removeItem(
        "campuschat_partner"
    );


    window.currentPartnerUserId =
        null;
}


// ==========================================
// RESTORE PARTNER
// ==========================================

function restorePartner() {

    try {

        const savedPartner =
            sessionStorage.getItem(
                "campuschat_partner"
            );


        if (!savedPartner) {
            return null;
        }


        const partner =
            JSON.parse(savedPartner);


        if (
            !partner ||
            !partner.id ||
            !partner.username
        ) {

            sessionStorage.removeItem(
                "campuschat_partner"
            );

            return null;
        }


        currentPartner =
            partner;

        connectedToPartner =
            true;

        window.currentPartnerUserId =
            partner.id;


        return partner;

    } catch (error) {

        console.error(
            "Unable to restore partner:",
            error
        );


        sessionStorage.removeItem(
            "campuschat_partner"
        );


        return null;
    }
}


// ==========================================
// UPDATE PARTNER UI
// ==========================================

function setChatPartner(username) {

    const topPartner =
        document.getElementById(
            "topPartnerUsername"
        );

    const headerPartner =
        document.getElementById(
            "partnerUsername"
        );


    if (username) {

        if (topPartner) {

            topPartner.textContent =
                username;

        }


        if (headerPartner) {

            headerPartner.textContent =
                username;

        }


        connectedToPartner =
            true;


        updateEmptyState(
            true,
            username
        );

    } else {

        if (topPartner) {

            topPartner.textContent =
                "Finding someone...";

        }


        if (headerPartner) {

            headerPartner.textContent =
                "Finding someone...";

        }


        connectedToPartner =
            false;


        updateEmptyState(
            false
        );
    }
}


// ==========================================
// EMPTY STATE
// ==========================================

function updateEmptyState(
    connected,
    partnerName = ""
) {

    const title =
        document.getElementById(
            "emptyTitle"
        );


    const text =
        document.getElementById(
            "emptyText"
        );


    if (!title || !text) {
        return;
    }


    if (connected) {

        title.textContent =
            `You're connected with ${partnerName}`;


        text.textContent =
            "Send a message to start chatting.";

    } else {

        title.textContent =
            "Finding someone...";


        text.textContent =
            "Please wait while we connect you with another student.";
    }
}


// ==========================================
// INITIAL STATE
// ==========================================

const restoredPartner =
    restorePartner();


if (restoredPartner) {

    setChatPartner(
        restoredPartner.username
    );

} else {

    setChatPartner(null);
}


// ==========================================
// DISPLAY MESSAGE
// ==========================================

function displayMessage(data) {

    const container =
        document.getElementById(
            "messages"
        );


    if (!container) {
        return;
    }


    const emptyState =
        document.getElementById(
            "emptyState"
        );


    if (emptyState) {
        emptyState.remove();
    }


    const message =
        document.createElement("div");


    message.className =
        "message";


    if (
        String(data.userId) ===
        String(user.id)
    ) {

        message.classList.add(
            "mine"
        );
    }


    const name =
        document.createElement("div");


    name.className =
        "name";


    name.textContent =
        data.username || "User";


    const time =
        document.createElement("span");


    time.className =
        "time";


    if (data.time) {

        time.textContent =
            new Date(
                data.time
            ).toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );
    }


    name.appendChild(
        time
    );


    const text =
        document.createElement("div");


    text.className =
        "text";


    text.textContent =
        data.message || "";


    message.appendChild(
        name
    );


    message.appendChild(
        text
    );


    // ======================================
    // REPORT OTHER USER'S MESSAGE
    // ======================================

    if (
        String(data.userId) !==
        String(user.id)
    ) {

        const reportButton =
            document.createElement(
                "button"
            );


        reportButton.className =
            "reportButton";


        reportButton.textContent =
            "🚨 Report";


        reportButton.addEventListener(
            "click",
            () => {

                reportMessage(
                    data.id
                );

            }
        );


        message.appendChild(
            reportButton
        );
    }


    container.appendChild(
        message
    );


    container.scrollTop =
        container.scrollHeight;
}


// ==========================================
// MESSAGE HISTORY
// ==========================================

socket.on(
    "messageHistory",
    messages => {

        const container =
            document.getElementById(
                "messages"
            );


        if (!container) {
            return;
        }


        container.innerHTML =
            "";


        if (
            !messages ||
            messages.length === 0
        ) {

            container.innerHTML = `

                <div id="emptyState">

                    <div class="emptyIcon">
                        💬
                    </div>

                    <h3 id="emptyTitle">
                        ${
                            currentPartner
                            ? `You're connected with ${escapeHTML(currentPartner.username)}`
                            : "Finding someone..."
                        }
                    </h3>

                    <p id="emptyText">
                        ${
                            currentPartner
                            ? "Send a message to start chatting."
                            : "Please wait while we connect you with another student."
                        }
                    </p>

                </div>

            `;

            return;
        }


        messages.forEach(
            message => {

                displayMessage(
                    message
                );

            }
        );

    }
);


// ==========================================
// NEW MESSAGE
// ==========================================

socket.on(
    "chatMessage",
    data => {

        displayMessage(
            data
        );

    }
);


// ==========================================
// SEND MESSAGE
// ==========================================

function sendMessage() {

    const input =
        document.getElementById(
            "messageInput"
        );


    if (!input) {
        return;
    }


    const message =
        input.value.trim();


    if (!message) {
        return;
    }


    if (!connectedToPartner) {

        alert(
            "Please wait until you are connected to another user."
        );

        return;
    }


    socket.emit(
        "chatMessage",
        {
            message: message
        }
    );


    input.value =
        "";


    input.focus();
}


// ==========================================
// ENTER KEY
// ==========================================

const messageInput =
    document.getElementById(
        "messageInput"
    );


if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );
}


// ==========================================
// CHAT ERROR
// ==========================================

socket.on(
    "chatError",
    message => {

        alert(
            message
        );

    }
);


// ==========================================
// SOCKET CONNECTION
// ==========================================

socket.on(
    "connect",
    () => {

        console.log(
            "Socket connected:",
            socket.id
        );


        socket.emit(
            "getCurrentRoom"
        );

    }
);


// ==========================================
// CONNECTION ERROR
// ==========================================

socket.on(
    "connect_error",
    error => {

        console.error(
            "Socket connection error:",
            error.message
        );


        if (
            error.message ===
                "Authentication required" ||

            error.message ===
                "Invalid authentication token"
        ) {

            localStorage.removeItem(
                "campuschat_token"
            );


            localStorage.removeItem(
                "campuschat_user"
            );


            clearPartner();


            window.location.href =
                "/login.html";
        }

    }
);


// ==========================================
// MATCHED
// ==========================================

socket.on(
    "matched",
    data => {

        console.log(
            "Matched:",
            data
        );


        if (
            !data ||
            !data.partner ||
            !data.partner.id
        ) {

            clearPartner();

            setChatPartner(
                null
            );

            return;
        }


        // ==================================
        // SAVE COMPLETE PARTNER OBJECT
        // ==================================

        currentPartner = {

            id:
                data.partner.id,

            username:
                data.partner.username

        };


        // ==================================
        // SAVE FOR VIDEO.JS
        // ==================================

        savePartner(
            currentPartner
        );


        // ==================================
        // UPDATE CHAT UI
        // ==================================

        setChatPartner(
            currentPartner.username
        );


        console.log(
            "Video partner ID:",
            window.currentPartnerUserId
        );


        const container =
            document.getElementById(
                "messages"
            );


        if (container) {

            container.innerHTML = `

                <div id="emptyState">

                    <div class="emptyIcon">
                        💬
                    </div>

                    <h3 id="emptyTitle">
                        You're connected with
                        ${escapeHTML(
                            currentPartner.username
                        )}
                    </h3>

                    <p id="emptyText">
                        Send a message to start chatting.
                    </p>

                </div>

            `;
        }

    }
);


// ==========================================
// WAITING
// ==========================================

socket.on(
    "waiting",
    data => {

        console.log(
            "Waiting:",
            data
        );


        clearPartner();


        setChatPartner(
            null
        );

    }
);


// ==========================================
// PARTNER LEFT
// ==========================================

socket.on(
    "partner-left",
    data => {

        console.log(
            "Partner left:",
            data
        );


        // End video call if active
        if (
            typeof endVideoCall ===
            "function"
        ) {

            try {

                endVideoCall();

            } catch (error) {

                console.log(
                    "Video cleanup:",
                    error
                );

            }

        }


        clearPartner();


        setChatPartner(
            null
        );


        const container =
            document.getElementById(
                "messages"
            );


        if (container) {

            container.innerHTML = `

                <div id="emptyState">

                    <div class="emptyIcon">
                        🔎
                    </div>

                    <h3 id="emptyTitle">
                        Finding someone...
                    </h3>

                    <p id="emptyText">
                        Your previous connection ended.
                        We're looking for a new user.
                    </p>

                </div>

            `;

        }

    }
);


// ==========================================
// ROOM ENDED
// ==========================================

socket.on(
    "room-ended",
    data => {

        console.log(
            "Room ended:",
            data
        );


        if (
            typeof endVideoCall ===
            "function"
        ) {

            try {

                endVideoCall();

            } catch (error) {

                console.log(
                    "Video cleanup:",
                    error
                );

            }

        }


        clearPartner();


        setChatPartner(
            null
        );

    }
);


// ==========================================
// NO ROOM
// ==========================================

socket.on(
    "noRoom",
    () => {

        console.log(
            "No current room."
        );


        clearPartner();


        setChatPartner(
            null
        );

    }
);


// ==========================================
// SKIP USER
// ==========================================

function skipUser() {

    if (!connectedToPartner) {

        return;
    }


    const confirmed =
        confirm(
            "Skip this user and find someone new?"
        );


    if (!confirmed) {

        return;
    }


    // ======================================
    // END VIDEO FIRST
    // ======================================

    if (
        typeof endVideoCall ===
        "function"
    ) {

        try {

            endVideoCall();

        } catch (error) {

            console.log(
                "Video call cleanup:",
                error
            );

        }

    }


    // ======================================
    // CLEAR PARTNER
    // ======================================

    clearPartner();


    setChatPartner(
        null
    );


    // ======================================
    // TELL SERVER
    // ======================================

    socket.emit(
        "skipUser"
    );


    const container =
        document.getElementById(
            "messages"
        );


    if (container) {

        container.innerHTML = `

            <div id="emptyState">

                <div class="emptyIcon">
                    🔎
                </div>

                <h3 id="emptyTitle">
                    Finding someone...
                </h3>

                <p id="emptyText">
                    Looking for a new student to chat with.
                </p>

            </div>

        `;

    }

}


// ==========================================
// REPORT MESSAGE
// ==========================================

async function reportMessage(
    messageId
) {

    if (!messageId) {

        alert(
            "Unable to identify this message."
        );

        return;
    }


    const reason =
        prompt(
            "Why are you reporting this message?"
        );


    if (
        !reason ||
        !reason.trim()
    ) {

        return;
    }


    try {

        const response =
            await fetch(
                "/api/reports",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body:
                        JSON.stringify({

                            messageId:
                                messageId,

                            reason:
                                reason.trim()

                        })

                }
            );


        const result =
            await response.json();


        alert(
            result.message ||
            "Report submitted."
        );


    } catch (error) {

        console.error(
            "Report error:",
            error
        );


        alert(
            "Unable to submit report."
        );

    }

}


// ==========================================
// HTML ESCAPE
// ==========================================

function escapeHTML(value) {

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


// ==========================================
// VIDEO CALL
// ==========================================

function startVideoCall() {

    console.log(
        "Starting video call..."
    );


    // ======================================
    // CHECK PARTNER
    // ======================================

    if (
        !currentPartner ||
        !currentPartner.id
    ) {

        alert(
            "You are not connected to another user."
        );

        return;
    }


    // ======================================
    // CHEC
