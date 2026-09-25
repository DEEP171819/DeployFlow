document
    .getElementById("login-form")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const email =
                document
                    .getElementById("email")
                    .value
                    .trim();

            const password =
                document
                    .getElementById("password")
                    .value;

            const message =
                document.getElementById(
                    "login-message"
                );

            try {

                const response =
                    await fetch(
                        "/api/auth/login",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    email,
                                    password
                                })
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        "Login failed"
                    );
                }

                localStorage.setItem(
                    "deployflow_token",
                    data.token
                );

                window.location.href =
                    "/";

            } catch (error) {

                message.textContent =
                    error.message;
            }
        }
    );