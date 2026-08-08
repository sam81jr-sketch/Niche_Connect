// ==========================================
// NICHE CONNECT - VIDEO CALL MODULE
// ==========================================

"use strict";

console.log("VIDEO.JS: loading...");

// ==========================================
// SOCKET
// ==========================================

const videoSocket = window.chatSocket;

if (!videoSocket) {
    console.error(
        "VIDEO.JS: chatSocket is not available."
    );
} else {
    console.log(
        "VIDEO.JS: chatSocket found."
    );
}

// ==========================================
// VARIABLES
// ==========================================

let localStream = null;
let peerConnection = null;

let currentCallId = null;
let currentTargetUserId = null;

let isCaller = false;

let pendingCandidates = [];

const ICE_SERVERS = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: "stun:stun1.l.google.com:19302"
        }
    ]
};

// ==========================================
// ELEMENT HELPER
// ==========================================

function getElement(id) {
    return document.getElementById(id);
}

// ==========================================
// CALL PANEL
// ==========================================

function showCallPanel() {

    const panel = getElement("callPanel");

    if (panel) {
        panel.style.display = "flex";
    }
}

function hideCallPanel() {

    const panel = getElement("callPanel");

    if (panel) {
        panel.style.display = "none";
    }
}

// ==========================================
// STATUS
// ==========================================

function setCallStatus(text) {

    const status = getElement("callStatus");

    if (status) {
        status.textContent = text;
    }
}

// ==========================================
// CREATE PEER CONNECTION
// ==========================================

function createPeerConnection() {

    if (peerConnection) {
        return peerConnection;
    }

    peerConnection =
        new RTCPeerConnection(
            ICE_SERVERS
        );

    // --------------------------------------
    // ICE CANDIDATE
    // --------------------------------------

    peerConnection.onicecandidate =
        event => {

            if (!event.candidate) {
                return;
            }

            if (!videoSocket) {
                console.error(
                    "VIDEO.JS: socket unavailable."
                );
                return;
            }

            if (!currentTargetUserId) {
                console.warn(
                    "VIDEO.JS: no target user."
                );
                return;
            }

            videoSocket.emit(
                "ice-candidate",
                {
                    targetUserId:
                        currentTargetUserId,

                    candidate:
                        event.candidate,

                    callId:
                        currentCallId
                }
            );
        };

    // --------------------------------------
    // REMOTE TRACK
    // --------------------------------------

    peerConnection.ontrack =
        event => {

            console.log(
                "VIDEO.JS: remote track received."
            );

            const remoteVideo =
                getElement("remoteVideo");

            if (!remoteVideo) {
                console.error(
                    "VIDEO.JS: remoteVideo element missing."
                );
                return;
            }

            if (
                event.streams &&
                event.streams[0]
            ) {

                remoteVideo.srcObject =
                    event.streams[0];

                remoteVideo.play()
                    .catch(
                        error => {
                            console.log(
                                "Remote video autoplay:",
                                error
                            );
                        }
                    );
            }

            setCallStatus(
                "Connected"
            );
        };

    // --------------------------------------
    // CONNECTION STATE
    // --------------------------------------

    peerConnection.onconnectionstatechange =
        () => {

            if (!peerConnection) {
                return;
            }

            console.log(
                "VIDEO.JS WebRTC state:",
                peerConnection.connectionState
            );

            switch (
                peerConnection.connectionState
            ) {

                case "connected":

                    setCallStatus(
                        "Connected"
                    );

                    break;

                case "connecting":

                    setCallStatus(
                        "Connecting..."
                    );

                    break;

                case "disconnected":

                    setCallStatus(
                        "Connection lost"
                    );

                    break;

                case "failed":

                    setCallStatus(
                        "Connection failed"
                    );

                    break;

                case "closed":

                    setCallStatus(
                        "Call ended"
                    );

                    break;
            }
        };

    // --------------------------------------
    // SIGNALING STATE
    // --------------------------------------

    peerConnection.onsignalingstatechange =
        () => {

            if (peerConnection) {

                console.log(
                    "VIDEO.JS signaling state:",
                    peerConnection.signalingState
                );
            }
        };

    return peerConnection;
}

// ==========================================
// CAMERA + MICROPHONE
// ==========================================

async function getLocalStream() {

    if (localStream) {
        return localStream;
    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        throw new Error(
            "Camera and microphone are not available. Please use HTTPS."
        );
    }

    console.log(
        "VIDEO.JS: requesting camera and microphone..."
    );

    localStream =
        await navigator.mediaDevices.getUserMedia(
            {
                video: {
                    facingMode: "user",

                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    }
                },

                audio: true
            }
        );

    console.log(
        "VIDEO.JS: camera and microphone ready."
    );

    const localVideo =
        getElement("localVideo");

    if (localVideo) {

        localVideo.srcObject =
            localStream;

        localVideo.muted =
            true;

        localVideo.autoplay =
            true;

        localVideo.playsInline =
            true;

        try {

            await localVideo.play();

        } catch (error) {

            console.log(
                "Local video autoplay:",
                error
            );
        }
    }

    return localStream;
}

// ==========================================
// ADD LOCAL TRACKS
// ==========================================

function addLocalTracks() {

    if (!peerConnection) {
        return;
    }

    if (!localStream) {
        return;
    }

    const senders =
        peerConnection.getSenders();

    localStream
        .getTracks()
        .forEach(
            track => {

                const alreadyAdded =
                    senders.some(
                        sender =>
                            sender.track ===
                            track
                    );

                if (!alreadyAdded) {

                    peerConnection.addTrack(
                        track,
                        localStream
                    );

                    console.log(
                        "VIDEO.JS: added track:",
                        track.kind
                    );
                }
            }
        );
}

// ==========================================
// START VIDEO CALL
// ==========================================

async function callUser(
    targetUserId,
    callType = "video"
) {

    console.log(
        "VIDEO.JS: callUser()",
        targetUserId
    );

    try {

        if (!videoSocket) {

            throw new Error(
                "Video socket is not available."
            );
        }

        if (!targetUserId) {

            throw new Error(
                "Unable to find the other user."
            );
        }

        currentTargetUserId =
            targetUserId;

        isCaller =
            true;

        showCallPanel();

        setCallStatus(
            "Opening camera..."
        );

        await getLocalStream();

        createPeerConnection();

        addLocalTracks();

        setCallStatus(
            "Calling..."
        );

        videoSocket.emit(
            "call-user",
            {
                targetUserId:
                    targetUserId,

                callType:
                    callType
            }
        );

        console.log(
            "VIDEO.JS: call-user emitted."
        );

    } catch (error) {

        console.error(
            "VIDEO.JS: unable to start call:",
            error
        );

        setCallStatus(
            "Camera error"
        );

        alert(
            error.message ||
            "Unable to access camera or microphone."
        );

        cleanupCall();
    }
}

// ==========================================
// INCOMING CALL
// ==========================================

if (videoSocket) {

    videoSocket.on(
        "incoming-call",
        async data => {

            console.log(
                "VIDEO.JS: incoming call:",
                data
            );

            if (!data) {
                return;
            }

            currentCallId =
                data.callId ||
                null;

            currentTargetUserId =
                data.callerId ||
                data.userId ||
                data.fromUserId ||
                null;

            const callerName =
                data.callerUsername ||
                data.username ||
                data.fromUsername ||
                "Someone";

            const accepted =
                confirm(
                    `${callerName} is calling you. Accept video call?`
                );

            if (!accepted) {

                videoSocket.emit(
                    "reject-call",
                    {
                        callId:
                            currentCallId,

                        targetUserId:
                            currentTargetUserId
                    }
                );

                cleanupCall();

                return;
            }

            try {

                showCallPanel();

                setCallStatus(
                    "Opening camera..."
                );

                await getLocalStream();

                createPeerConnection();

                addLocalTracks();

                setCallStatus(
                    "Connecting..."
                );

                videoSocket.emit(
                    "answer-call",
                    {
                        callId:
                            currentCallId,

                        targetUserId:
                            currentTargetUserId
                    }
                );

            } catch (error) {

                console.error(
                    "VIDEO.JS: incoming call error:",
                    error
                );

                alert(
                    error.message ||
                    "Unable to access camera."
                );

                cleanupCall();
            }
        }
    );

    // ======================================
    // CALL ACCEPTED
    // ======================================

    videoSocket.on(
        "call-accepted",
        async data => {

            console.log(
                "VIDEO.JS: call accepted:",
                data
            );

            try {

                if (data) {

                    currentCallId =
                        data.callId ||
                        currentCallId;
                }

                if (!peerConnection) {

                    createPeerConnection();

                    addLocalTracks();
                }

                const offer =
                    await peerConnection.createOffer();

                await peerConnection.setLocalDescription(
                    offer
                );

                videoSocket.emit(
                    "offer",
                    {
                        targetUserId:
                            currentTargetUserId,

                        callId:
                            currentCallId,

                        offer:
                            offer
                    }
                );

                setCallStatus(
                    "Connecting..."
                );

            } catch (error) {

                console.error(
                    "VIDEO.JS: offer error:",
                    error
                );

                setCallStatus(
                    "Call failed"
                );
            }
        }
    );

    // ======================================
    // OFFER
    // ======================================

    videoSocket.on(
        "offer",
        async data => {

            try {

                console.log(
                    "VIDEO.JS: received offer."
                );

                if (!data) {
                    return;
                }

                currentCallId =
                    data.callId ||
                    currentCallId;

                currentTargetUserId =
                    data.callerId ||
                    data.userId ||
                    data.fromUserId ||
                    currentTargetUserId;

                if (!peerConnection) {

                    createPeerConnection();

                    await getLocalStream();

                    addLocalTracks();
                }

                await peerConnection.setRemoteDescription(
                    new RTCSessionDescription(
                        data.offer
                    )
                );

                for (
                    const candidate
                    of pendingCandidates
                ) {

                    try {

                        await peerConnection.addIceCandidate(
                            candidate
                        );

                    } catch (error) {

                        console.error(
                            "VIDEO.JS queued ICE error:",
                            error
                        );
                    }
                }

                pendingCandidates =
                    [];

                const answer =
                    await peerConnection.createAnswer();

                await peerConnection.setLocalDescription(
                    answer
                );

                videoSocket.emit(
                    "answer",
                    {
                        targetUserId:
                            currentTargetUserId,

                        callId:
                            currentCallId,

                        answer:
                            answer
                    }
                );

                setCallStatus(
                    "Connecting..."
                );

            } catch (error) {

                console.error(
                    "VIDEO.JS offer handling error:",
                    error
                );

                setCallStatus(
                    "Call failed"
                );
            }
        }
    );

    // ======================================
    // ANSWER
    // ======================================

    videoSocket.on(
        "answer",
        async data => {

            try {

                console.log(
                    "VIDEO.JS: received answer."
                );

                if (!data) {
                    return;
                }

                if (!peerConnection) {
                    return;
                }

                await peerConnection.setRemoteDescription(
                    new RTCSessionDescription(
                        data.answer
                    )
                );

                for (
                    const candidate
                    of pendingCandidates
                ) {

                    try {

                        await peerConnection.addIceCandidate(
                            candidate
                        );

                    } catch (error) {

                        console.error(
                            "VIDEO.JS ICE queue error:",
                            error
                        );
                    }
                }

                pendingCandidates =
                    [];

                setCallStatus(
                    "Connected"
                );

            } catch (error) {

                console.error(
                    "VIDEO.JS answer handling error:",
                    error
                );

                setCallStatus(
                    "Call failed"
                );
            }
        }
    );

    // ======================================
    // ICE CANDIDATE
    // ======================================

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

                const candidate =
                    new RTCIceCandidate(
                        data.candidate
                    );

                if (
                    peerConnection &&
                    peerConnection.remoteDescription
                ) {

                    await peerConnection.addIceCandidate(
                        candidate
                    );

                } else {

                    pendingCandidates.push(
                        candidate
                    );
                }

            } catch (error) {

                console.error(
                    "VIDEO.JS ICE candidate error:",
                    error
                );
            }
        }
    );

    // ======================================
    // CALL REJECTED
    // ======================================

    videoSocket.on(
        "call-rejected",
        () => {

            alert(
                "The other user rejected the video call."
            );

            cleanupCall();
        }
    );

    // ======================================
    // CALL ENDED
    // ======================================

    videoSocket.on(
        "call-ended",
        () => {

            setCallStatus(
                "Call ended"
            );

            cleanupCall();
        }
    );

    // ======================================
    // PARTNER LEFT
    // ======================================

    videoSocket.on(
        "partner-left",
        () => {

            console.log(
                "VIDEO.JS: partner left."
            );

            cleanupCall();
        }
    );

    // ======================================
    // SOCKET ERROR
    // ======================================

    videoSocket.on(
        "connect_error",
        error => {

            console.error(
                "VIDEO.JS socket error:",
                error.message
            );
        }
    );
}

// ==========================================
// MUTE
// ==========================================

function toggleMute() {

    if (!localStream) {
        return;
    }

    const audioTracks =
        localStream.getAudioTracks();

    if (
        audioTracks.length === 0
    ) {
        return;
    }

    audioTracks.forEach(
        track => {

            track.enabled =
                !track.enabled;
        }
    );

    const button =
        getElement("muteButton");

    if (button) {

        const enabled =
            audioTracks[0].enabled;

        button.textContent =
            enabled
                ? "🎤"
                : "🔇";
    }
}

// ==========================================
// CAMERA
// ==========================================

function toggleCamera() {

    if (!localStream) {
        return;
    }

    const videoTracks =
        localStream.getVideoTracks();

    if (
        videoTracks.length === 0
    ) {
        return;
    }

    videoTracks.forEach(
        track => {

            track.enabled =
                !track.enabled;
        }
    );

    const button =
        getElement("cameraButton");

    if (button) {

        const enabled =
            videoTracks[0].enabled;

        button.textContent =
            enabled
                ? "📷"
                : "🚫";
    }
}

// ==========================================
// END VIDEO CALL
// ==========================================

function endVideoCall() {

    console.log(
        "VIDEO.JS: ending call."
    );

    if (
        videoSocket &&
        currentTargetUserId
    ) {

        videoSocket.emit(
            "end-call",
            {
                targetUserId:
                    currentTargetUserId,

                callId:
                    currentCallId
            }
        );
    }

    cleanupCall();
}

// ==========================================
// CLEANUP
// ==========================================

function cleanupCall() {

    console.log(
        "VIDEO.JS: cleaning up call."
    );

    if (peerConnection) {

        try {

            peerConnection.onicecandidate =
                null;

            peerConnection.ontrack =
                null;

            peerConnection.close();

        } catch (error) {

            console.log(
                "Peer cleanup error:",
                error
            );
        }

        peerConnection =
            null;
    }

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track => {

                    try {
                        track.stop();
                    } catch (error) {
                        console.log(error);
                    }
                }
            );

        localStream =
            null;
    }

    const localVideo =
        getElement("localVideo");

    const remoteVideo =
        getElement("remoteVideo");

    if (localVideo) {
        localVideo.srcObject =
            null;
    }

    if (remoteVideo) {
        remoteVideo.srcObject =
            null;
    }

    currentCallId =
        null;

    currentTargetUserId =
        null;

    isCaller =
        false;

    pendingCandidates =
        [];

    hideCallPanel();

    setCallStatus(
        "Ready"
    );
}

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

window.callUser =
    callUser;

window.endVideoCall =
    endVideoCall;

window.toggleMute =
    toggleMute;

window.toggleCamera =
    toggleCamera;

// ==========================================
// CONFIRM MODULE LOADED
// ==========================================

console.log(
    "VIDEO.JS LOADED SUCCESSFULLY"
);

console.log(
    "callUser:",
    typeof window.callUser
);

console.log(
    "endVideoCall:",
    typeof window.endVideoCall
);

console.log(
    "toggleMute:",
    typeof window.toggleMute
);

console.log(
    "toggleCamera:",
    typeof window.toggleCamera
);
