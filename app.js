async function api(action, payload = {}) {
  if (!API_URL) throw new Error("ยังไม่ได้ตั้งค่า Google Apps Script URL");

  return new Promise((resolve, reject) => {
    const id = `fmea-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const frame = document.createElement("iframe");
    frame.name = `fmea-api-${id}`;
    frame.style.display = "none";
    let timer;

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      frame.remove();
    };

    const receive = (event) => {
      if (event.source !== frame.contentWindow) return;
      const msg = event.data;
      if (!msg || msg.type !== "FMEA_API_RESPONSE" || msg.requestId !== id) return;

      cleanup();
      const data = msg.data || {};

      if (data.ok) resolve(data);
      else reject(new Error(data.error || "ไม่สามารถเชื่อมต่อฐานข้อมูลได้"));
    };

    window.addEventListener("message", receive);
    document.body.appendChild(frame);

    timer = setTimeout(() => {
      cleanup();
      reject(new Error("เชื่อมต่อฐานข้อมูลหมดเวลา กรุณาลองใหม่"));
    }, 20000);

    const form = document.createElement("form");
    form.method = "POST";
    form.action = API_URL;
    form.target = frame.name;
    form.style.display = "none";

    const add = (name, value) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    add("requestId", id);
    add("payload", JSON.stringify({
      action,
      code: state.code,
      ...payload
    }));

    document.body.appendChild(form);
    form.submit();
    form.remove();
  });
}
