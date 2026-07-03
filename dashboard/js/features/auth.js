import {
    MOCK_ACCOUNT,
    MOCK_PASSWORD_ALIASES,
    clearMockSession,
    getMockSession,
    setMockSession
} from "../core/firebase.js";
import {
    setAppLocked,
    setLoginStatus,
    showToast
} from "../core/ui.js";

export function initAuth() {
    const loginForm = document.getElementById("login-form");
    const loginEmail = document.getElementById("login-email");
    const loginPassword = document.getElementById("login-password");
    const loginButton = document.getElementById("login-button");
    const authUserLabel = document.getElementById("auth-user-label");
    const logoutButton = document.getElementById("logout-button");

    const existingMockSession = getMockSession();
    if (existingMockSession?.email === MOCK_ACCOUNT.email) {
        setAppLocked(false);
        if (authUserLabel) {
            authUserLabel.innerText = existingMockSession.displayName || existingMockSession.email;
        }
        if (loginEmail) {
            loginEmail.value = existingMockSession.email;
        }
        setLoginStatus("Đang mở dashboard cục bộ...", "success");
    } else {
        setAppLocked(true);
        if (authUserLabel) {
            authUserLabel.innerText = "Chưa đăng nhập";
        }
        setLoginStatus(`Tài khoản cục bộ: ${MOCK_ACCOUNT.email}`, "info");
        if (loginEmail && !loginEmail.value) {
            loginEmail.value = MOCK_ACCOUNT.email;
        }
    }

    loginForm?.addEventListener("submit", async event => {
        event.preventDefault();

        const email = loginEmail?.value.trim();
        const password = loginPassword?.value || "";

        if (!email || !password) {
            setLoginStatus("Nhập đủ email và mật khẩu.", "warning");
            return;
        }

        if (loginButton) {
            loginButton.disabled = true;
        }
        setLoginStatus("Đang kiểm tra tài khoản cục bộ...", "info");

        try {
            const isValidUser = email.toLowerCase() === MOCK_ACCOUNT.email.toLowerCase() && MOCK_PASSWORD_ALIASES.includes(password);
            if (!isValidUser) {
                throw new Error("auth/invalid-credential");
            }

            setMockSession({
                email: MOCK_ACCOUNT.email,
                displayName: MOCK_ACCOUNT.displayName
            });
            setAppLocked(false);
            if (authUserLabel) {
                authUserLabel.innerText = MOCK_ACCOUNT.displayName;
            }
            setLoginStatus("Đăng nhập thành công.", "success");
            showToast("Đăng nhập thành công", `Xin chào ${MOCK_ACCOUNT.displayName}.`, "success");
        } catch (error) {
            console.error("Đăng nhập thất bại:", error);
            const message = "Sai email hoặc mật khẩu cục bộ.";
            setLoginStatus(message, "error");
            showToast("Đăng nhập thất bại", message, "error");
        } finally {
            if (loginButton) {
                loginButton.disabled = false;
            }
        }
    });

    logoutButton?.addEventListener("click", async () => {
        clearMockSession();
        if (loginButton) {
            loginButton.disabled = false;
        }
        if (loginPassword) {
            loginPassword.value = "";
        }
        setAppLocked(true);
        setLoginStatus("Đăng xuất thành công. Dùng tài khoản cục bộ để vào lại.", "info");
        if (authUserLabel) {
            authUserLabel.innerText = "Chưa đăng nhập";
        }
        showToast("Đã đăng xuất", "Phiên cục bộ đã kết thúc.", "info");
    });
}
