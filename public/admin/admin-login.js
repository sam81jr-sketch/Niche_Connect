const form =
    document.getElementById(
        "adminLoginForm"
    );

const error =
    document.getElementById(
        "error"
    );


form.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const username =
            document.getElementById(
                "username"
            ).value.trim();


        const password =
            document.getElementById(
                "password"
            ).value;


        error.textContent =
            "Logging in...";


        try {

            const response =
                await fetch(
                    "/api/admin-auth/login",
                    {

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                username:
                                    username,

                                password:
                                    password

                            })

                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                error.textContent =
                    data.message ||
                    "Login failed.";

                return;

            }


            if (
                !data.success ||
                !data.token
            ) {

                error.textContent =
                    "Invalid server response.";

                return;

            }


            // Store admin JWT

            localStorage.setItem(
                "campuschat_admin_token",
                data.token
            );


            // Go to dashboard

            window.location.href =
                "/admin/dashboard.html";


        } catch (err) {

            console.error(err);

            error.textContent =
                "Unable to connect to server.";

        }

    }
);
