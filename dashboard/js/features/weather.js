export function initWeatherWidget() {
    const weatherInfo = document.getElementById("weather-info");
    if (!weatherInfo) {
        return;
    }

    const FALLBACK_LOCATION = {
        label: "TP.HCM",
        latitude: 10.75,
        longitude: 106.67
    };

    const WEATHER_META = {
        0: { icon: "fa-sun", text: "Trời quang" },
        1: { icon: "fa-cloud-sun", text: "Ít mây" },
        2: { icon: "fa-cloud-sun", text: "Có mây" },
        3: { icon: "fa-cloud", text: "Nhiều mây" },
        45: { icon: "fa-smog", text: "Sương mù" },
        48: { icon: "fa-smog", text: "Sương mù" },
        51: { icon: "fa-cloud-rain", text: "Mưa phùn" },
        53: { icon: "fa-cloud-rain", text: "Mưa phùn" },
        55: { icon: "fa-cloud-rain", text: "Mưa phùn" },
        61: { icon: "fa-cloud-showers-heavy", text: "Mưa nhẹ" },
        63: { icon: "fa-cloud-showers-heavy", text: "Mưa vừa" },
        65: { icon: "fa-cloud-showers-heavy", text: "Mưa to" },
        71: { icon: "fa-snowflake", text: "Tuyết nhẹ" },
        73: { icon: "fa-snowflake", text: "Tuyết vừa" },
        75: { icon: "fa-snowflake", text: "Tuyết dày" },
        80: { icon: "fa-cloud-showers-heavy", text: "Mưa rào" },
        81: { icon: "fa-cloud-showers-heavy", text: "Mưa rào" },
        82: { icon: "fa-cloud-showers-heavy", text: "Mưa rào lớn" },
        95: { icon: "fa-bolt", text: "Giông bão" },
        96: { icon: "fa-bolt", text: "Giông bão" },
        99: { icon: "fa-bolt", text: "Giông bão" }
    };

    function formatLocationName(address, fallbackLabel) {
        if (!address) {
            return fallbackLabel;
        }

        const parts = [
            address.neighbourhood,
            address.suburb,
            address.quarter,
            address.city_district,
            address.city,
            address.town,
            address.village,
            address.county,
            address.state
        ].filter(Boolean);

        if (parts.length > 0) {
            const uniqueParts = [...new Set(parts)];
            return uniqueParts.slice(0, 2).join(", ");
        }

        return address.city || address.town || address.village || address.state || fallbackLabel;
    }

    function renderWeather({ label, temperature, code }) {
        const meta = WEATHER_META[code] || { icon: "fa-cloud", text: "Thời tiết" };
        const tempText = Number.isFinite(temperature) ? `${temperature.toFixed(1)}°C` : "--°C";
        const isMobile = window.matchMedia("(max-width: 767px)").matches;

        weatherInfo.innerHTML = isMobile
            ? `
                <span class="inline-flex items-center gap-2 min-w-0">
                    <i class="fa-solid ${meta.icon} text-sky-300 shrink-0"></i>
                    <span class="font-medium text-slate-100 truncate max-w-[9rem]">${tempText}</span>
                    <span class="text-slate-400 whitespace-nowrap">· ${meta.text}</span>
                </span>
            `
            : `
                <span class="inline-flex items-center gap-2">
                    <i class="fa-solid ${meta.icon} text-sky-300"></i>
                    <span class="font-medium text-slate-100">${label}</span>
                </span>
                <span class="text-slate-300">${tempText}</span>
                <span class="text-slate-400">${meta.text}</span>
            `;
    }

    async function fetchWeather(latitude, longitude, label) {
        try {
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
            if (!response.ok) {
                throw new Error(`Weather API error: ${response.status}`);
            }

            const data = await response.json();
            const current = data?.current_weather;
            if (current) {
                renderWeather({
                    label,
                    temperature: Number(current.temperature),
                    code: current.weathercode
                });
                return;
            }
        } catch (error) {
            console.error("Không thể tải dữ liệu thời tiết:", error);
        }

        renderWeather({
            label,
            temperature: null,
            code: undefined
        });
    }

    async function reverseGeocode(latitude, longitude, fallbackLabel) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=12&addressdetails=1&accept-language=vi`
            );
            if (!response.ok) {
                throw new Error(`Reverse geocode error: ${response.status}`);
            }

            const data = await response.json();
            return formatLocationName(data?.address, fallbackLabel);
        } catch (error) {
            console.error("Không thể xác định tên vị trí:", error);
            return fallbackLabel;
        }
    }

    function getCurrentPosition() {
        return new Promise(resolve => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                position => resolve(position),
                () => resolve(null),
                {
                    enableHighAccuracy: false,
                    timeout: 6000,
                    maximumAge: 600000
                }
            );
        });
    }

    async function loadWeather() {
        weatherInfo.innerText = "Đang lấy vị trí và thời tiết...";

        const position = await getCurrentPosition();
        if (position?.coords) {
            const { latitude, longitude } = position.coords;
            const locationName = await reverseGeocode(latitude, longitude, "Vị trí hiện tại");
            await fetchWeather(latitude, longitude, locationName);
            return;
        }

        await fetchWeather(FALLBACK_LOCATION.latitude, FALLBACK_LOCATION.longitude, FALLBACK_LOCATION.label);
    }

    loadWeather();
    setInterval(loadWeather, 600000);
}
