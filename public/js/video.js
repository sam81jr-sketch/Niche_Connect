// ==========================================
// CAMPUSCHAT - PRIVATE VIDEO CALL
// ==========================================

const videoSocket = io({
    auth: {
        token: localStorage.getItem("campuschat_token")
    }
});

let localStream = null;
let peerConnection = null;
let currentTargetUserId = null;
let currentCallType = "video";
let pendingIceCandidates = [];


// ==========================================
// CURRENT USER
// ==========================================

const savedUser =
    localStorage.getItem("campuschat_user");

let currentUser = null;

try {
    currentUser = JSON.parse(savedUser);
} catch (error) {
    console.error("Unable to read user:", error);
}


// ==========================================
// CURRENT MATCHED PARTNER
// ==========================================

function getPartner() {

    const savedPartner =
        sessionStorage.getItem(
            "campuschat_partner"
        );

    if (!savedPartner) {
        return null;
    }

    try {
        return JSON.parse(savedPartner);
    } catch (error) {
        console.error(
            "Invalid partner data:",
            error
        );

        return null;
    }
}


// ==========================================
// WEBRTC CONFIG
// ==========================================

const rtcConfig = {

    iceServers: [

        {
            urls:
                "stun:stun.l.google.com:19302"
        },

        {
            urls:
                "stun:stun1.l.google.com:19302"
        }

    ]

};


// ==========================================
// ELEMENT HELPERS
// ==========================================

function getElement(id) {
    return document.getElementById(id);
}


// ==========================================
// START CAMERA / MICROPHONE
// ==========================================

async function startMedia(callType = "video") {

    if (localStream) {
        return localStream;
    }

    currentCallType =
        callType;


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        throw new Error(
            "Camera and microphone are not available in this browser."
        );

    }


    localStream =
        await navigator.mediaDevices.getUserMedia({

            video:
                callType === "video",

            audio:
                true

        });


    const localVideo =
        getElement("localVideo");


    if (localVideo) {

        localVideo.srcObject =
            localStream;

        localVideo.muted =
            true;

        localVideo.playsInline =
            true;

        await localVideo.play()
            .catch(() => {});

    }


    return localStream;

}


// ==========================================
// CREATE PEER CONNECTION
// ==========================================

function createPeerConnection(targetUserId) {

    if (peerConnection) {

        peerConnection.close();

        peerConnection =
            null;

    }


    currentTargetUserId =
        String(targetUserId);


    peerConnection =
        new RTCPeerConnection(
            rtcConfig
        );


    // ======================================
    // ADD LOCAL TRACKS
    // ======================================

    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => {

                peerConnection.addTrack(
                    track,
                    localStream
                );

            });

    }


    // ======================================
    // RECEIVE REMOTE STREAM
    // ======================================

    peerConnection.ontrack =
        event => {

            const remoteVideo =
                getElement(
                    "remoteVideo"
                );


            if (
                remoteVideo &&
                event.streams &&
                event.streams[0]
            ) {

                remoteVideo.srcObject =
                    event.streams[0];

                remoteVideo.playsInline =
                    true;

                remoteVideo.play()
                    .catch(() => {});

            }

        };


    // ======================================
    // ICE CANDIDATES
    // ======================================

    peerConnection.onicecandidate =
        event => {

            if (
                !event.candidate ||
                !currentTargetUserId
            ) {

                return;

            }


            videoSocket.emit(
                "ice-candidate",
                {

                    targetUserId:
                        currentTargetUserId,

                    candidate:
                        event.candidate

                }
            );

        };


    // ======================================
    // CONNECTION STATE
    // ======================================

    peerConnection.onconnectionstatechange =
        () => {

            if (!peerConnection) {
                return;
            }


            const state =
                peerConnection.connectionState;


            console.log(
                "WebRTC connection:",
                state
            );


            updateCallStatus(
                state
            );


            if (
                state === "connected"
            ) {

                updateCallStatus(
                    "Connected"
                );

            }


            if (
                state === "failed"
            ) {

                updateCallStatus(
                    "Connection failed"
                );

            }


            if (
                state === "disconnected"
            ) {

                updateCallStatus(
                    "Connection lost"
                );

            }

        };


    return peerConnection;

}


// ==========================================
// CALL MATCHED PARTNER
// ==========================================

async function callUser(
    targetUserId = null,
    callType = "video"
) {

    try {

        const partner =
            getPartner();


        // Always prefer the actual matched partner

        if (
            partner &&
            partner.id
        ) {

            targetUserId =
                partner.id;

        }


        if (!targetUserId) {

            alert(
                "No chat partner is connected."
            );

            return;

        }


        // ==================================
        // START MEDIA
        // ==================================

        showCallPanel();

        updateCallStatus(
            "Starting camera..."
        );


        await startMedia(
            callType
        );


        // ==================================
        // CREATE CONNECTION
        // ==================================

        createPeerConnection(
            targetUserId
        );


        // ==================================
        // CREATE OFFER
        // ==================================

        const offer =
            await peerConnection
                .createOffer();


        await peerConnection
            .setLocalDescription(
                offer
            );


        // ==================================
        // SEND CALL REQUEST
        // ==================================

        videoSocket.emit(
            "call-user",
            {

                targetUserId:
                    currentTargetUserId,

                offer:
                    offer,

                callType:
                    callType

            }
        );


        updateCallStatus(
            "Calling " +
            (
                partner?.username ||
                "user"
            ) +
            "..."
        );


    } catch (error) {

        console.error(
            "Call failed:",
            error
        );


        alert(
            "Unable to start video call: " +
            error.message
        );


        endVideoCall(
            false
        );

    }

}


// ==========================================
// INCOMING CALL
// ==========================================

videoSocket.on(
    "incoming-call",
    async data => {

        try {

            if (!data) {
                return;
            }


            const partner =
                getPartner();


            // ==================================
            // SECURITY CHECK
            // Only accept call from current
            // matched partner.
            // ==================================

            if (
                partner &&
                String(data.fromUserId) !==
                String(partner.id)
            ) {

                console.warn(
                    "Blocked call from non-matched user:",
                    data.fromUserId
                );


                videoSocket.emit(
                    "reject-call",
                    {

                        targetUserId:
                            data.fromUserId

                    }
                );


                return;

            }


            const callerName =
                data.fromUsername ||
                partner?.username ||
                "CampusChat User";


            const callType =
                data.callType ||
                "video";


            const accepted =
                confirm(
                    callerName +
                    " is calling you.\n\n" +
                    "Accept the call?"
                );


            if (!accepted) {

                videoSocket.emit(
                    "reject-call",
                    {

                        targetUserId:
                            data.fromUserId

                    }
                );


                return;

            }


            // ==================================
            // ACCEPT CALL
            // ==================================

            showCallPanel();


            updateCallStatus(
                "Connecting..."
            );


            currentTargetUserId =
                String(
                    data.fromUserId
                );


            await startMedia(
                callType
            );


            createPeerConnection(
                data.fromUserId
            );


            // ==================================
            // SET OFFER
            // ==================================

            await peerConnection
                .setRemoteDescription(
                    new RTCSessionDescription(
                        data.offer
                    )
                );


            // ==================================
            // CREATE ANSWER
            // ==================================

            const answer =
                await peerConnection
                    .createAnswer();


            await peerConnection
                .setLocalDescription(
                    answer
                );


            // ==================================
            // SEND ANSWER
            // ==================================

            videoSocket.emit(
                "answer-call",
                {

                    targetUserId:
                        data.fromUserId,

                    answer:
                        answer

                }
            );


            updateCallStatus(
                "Connecting..."
            );


            // ==================================
            // ADD QUEUED ICE
            // ==================================

            await addPendingIceCandidates();

        } catch (error) {

            console.error(
                "Incoming call error:",
                error
            );


            alert(
                "Unable to answer call: " +
                error.message
            );


            endVideoCall(
                false
            );

        }

    }
);


// ==========================================
// ANSWER RECEIVED
// ==========================================

videoSocket.on(
    "call-answered",
    async data => {

        try {

            if (
                !peerConnection ||
                !data.answer
            ) {

                return;

            }


            await peerConnection
                .setRemoteDescription(
                    new RTCSessionDescription(
                        data.answer
                    )
                );


            await addPendingIceCandidates();


            updateCallStatus(
                "Connected"
            );

        } catch (error) {

            console.error(
                "Answer error:",
                error
            );

        }

    }
);


// ==========================================
// ICE CANDIDATE
// ==========================================

videoSocket.on(
    "ice-candidate",
    async data => {

        try {

            if (
                !data ||
                !data.candidate
            ) {

                return;

            }


            if (
                !peerConnection ||
                !peerConnection.remoteDescription
            ) {

                pendingIceCandidates.push(
                    data.candidate
                );

                return;

            }


            await peerConnection
                .addIceCandidate(
                    new RTCIceCandidate(
                        data.candidate
                    )
                );

        } catch (error) {

            console.error(
                "ICE candidate error:",
                error
            );

        }

    }
);


// ==========================================
// ADD PENDING ICE
// ==========================================

async function addPendingIceCandidates() {

    if (
        !peerConnection ||
        !peerConnection.remoteDescription
    ) {

        return;

    }


    const candidates =
        pendingIceCandidates;


    pendingIceCandidates =
        [];


    for (
        const candidate
        of candidates
    ) {

        try {

            await peerConnection
                .addIceCandidate(
                    new RTCIceCandidate(
                        candidate
                    )
                );

        } catch (error) {

            console.error(
                "Pending ICE error:",
                error
            );

        }

    }

}


// ==========================================
// CALL REJECTED
// ==========================================

videoSocket.on(
    "call-rejected",
    () => {

        updateCallStatus(
            "Call rejected"
        );


        alert(
            "The user rejected the call."
        );


        endVideoCall(
            false
        );

    }
);


// ==========================================
// CALL ENDED
// ==========================================

videoSocket.on(
    "call-ended",
    () => {

        updateCallStatus(
            "Call ended"
        );


        endVideoCall(
            false
        );

    }
);


// ==========================================
// CALL ERROR
// ==========================================

videoSocket.on(
    "call-error",
    message => {

        alert(
            message ||
            "Video call error."
        );


        endVideoCall(
            false
        );

    }
);


// ==========================================
// MUTE
// ==========================================

function toggleMute() {

    if (!localStream) {
        return;
    }


    const tracks =
        localStream.getAudioTracks();


    if (!tracks.length) {
        return;
    }


    const enabled =
        !tracks[0].enabled;


    tracks.forEach(
        track => {

            track.enabled =
                enabled;

        }
    );


    const button =
        getElement(
            "muteButton"
        );


    if (button) {

        button.textContent =
            enabled
                ? "🎤 Mute"
                : "🔇 Unmute";

    }

}


// ==========================================
// CAMERA
// ==========================================

function toggleCamera() {

    if (!localStream) {
        return;
    }


    const tracks =
        localStream.getVideoTracks();


    if (!tracks.length) {

        return;

    }


    const enabled =
        !tracks[0].enabled;


    tracks.forEach(
        track => {

            track.enabled =
                enabled;

        }
    );


    const button =
        getElement(
            "cameraButton"
        );


    if (button) {

        button.textContent =
            enabled
                ? "📷 Camera Off"
                : "📷 Camera On";

    }

}


// ==========================================
// HANG UP
// ==========================================

function endVideoCall(
    notify = true
) {

    const target =
        currentTargetUserId;


    // ======================================
    // INFORM OTHER USER
    // ======================================

    if (
        notify &&
        target
    ) {

        videoSocket.emit(
            "hang-up",
            {

                targetUserId:
                    target

            }
        );

    }


    // ======================================
    // CLOSE WEBRTC
    // ======================================

    if (peerConnection) {

        peerConnection.ontrack =
            null;

        peerConnection.onicecandidate =
            null;

        peerConnection.close();

        peerConnection =
            null;

    }


    // ======================================
    // STOP CAMERA / MICROPHONE
    // ======================================

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track => {

                    track.stop();

                }
            );

        localStream =
            null;

    }


    // ======================================
    // CLEAR VIDEOS
    // ======================================

    const localVideo =
        getElement(
            "localVideo"
        );

    const remoteVideo =
        getElement(
            "remoteVideo"
        );


    if (localVideo) {

        localVideo.srcObject =
            null;

    }


    if (remoteVideo) {

        remoteVideo.srcObject =
            null;

    }


    // ======================================
    // RESET STATE
    // ======================================

    currentTargetUserId =
        null;

    pendingIceCandidates =
        [];


    // ======================================
    // HIDE CALL PANEL
    // ======================================

    hideCallPanel();

}


// ==========================================
// SHOW CALL PANEL
// ==========================================

function showCallPanel() {

    const panel =
        getElement(
            "callPanel"
        );


    if (panel) {

        panel.style.display =
            "block";

    }

}


// ==========================================
// HIDE CALL PANEL
// ==========================================

function hideCallPanel() {

    const panel =
        getElement(
            "callPanel"
        );


    if (panel) {

        panel.style.display =
            "none";

    }

}


// ==========================================
// CALL STATUS
// ==========================================

function updateCallStatus(
    text
) {

    const status =
        getElement(
            "callStatus"
        );


    if (status) {

        status.textContent =
            text;

    }

}


// ==========================================
// SOCKET CONNECTION ERROR
// ==========================================

videoSocket.on(
    "connect_error",
    error => {

        console.error(
            "Video socket error:",
            error.message
        );

    }
);


// ==========================================
// EXPORT
// ==========================================

window.callUser =
    callUser;

window.startVideoCall =
    callUser;

window.toggleMute =
    toggleMute;

window.toggleCamera =
    toggleCamera;

window.endVideoCall =
    endVideoCall;

window.showCallPanel =
    showCallPanel;

window.hideCallPanel =
    hideCallPanel;
