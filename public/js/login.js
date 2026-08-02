async function register() {

    const username =
        document.getElementById("registerUsername").value.trim();

    const password =
        document.getElementById("registerPassword").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;

    const message =
        document.getElementById("registerMessage");


    if (!username || !password) {

        message.textContent =
            "Please fill in all fields.";

        return;
    }


    if (password !== confirmPassword) {

        message.textContent =
            "Passwords do not match.";

        return;
    }


    try {

        const response = await fetch(
            "/api/auth/register",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    username,
                    password
                })
            }
        );


        const data = await response.json();


        if (!data.success) {

            message.textContent =
                data.message;

            return;
        }


        message.style.color = "green";

        message.textContent =
            "Account created! You can now login.";

        setTimeout(() => {

            showLogin();

        }, 1000);


    } catch (error) {

        console.error(error);

        message.textContent =
            "Unable to connect to server.";

    }

}


async function login() {

    const username =
        document.getElementById("loginUsername").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    const message =
        document.getElementById("loginMessage");


    if (!username || !password) {

        message.textContent =
            "Please enter username and password.";

        return;
    }


    try {

        const response = await fetch(
            "/api/auth/login",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    username,
                    password
                })
            }
        );


        const data = await response.json();


        if (!data.success) {

            message.textContent =
                data.message;

            return;
        }


        localStorage.setItem(
            "campuschat_token",
            data.token
        );


        localStorage.setItem(
            "campuschat_user",
            JSON.stringify(data.user)
        );


        window.location.href =
            "/chat.html";


    } catch (error) {

        console.error(error);

        message.textContent =
            "Unable to connect to server.";

    }

}


function showRegister() {

    document.getElementById("loginBox")
        .style.display = "none";

    document.getElementById("registerBox")
        .style.display = "block";

}


function showLogin() {

    document.getElementById("registerBox")
        .style.display = "none";

    document.getElementById("loginBox")
        .style.display = "block";

}
