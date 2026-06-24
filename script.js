/* ===================== DATA ===================== */

const amDau = [
  "", "b", "c", "d", "đ", "g", "h", "k", "l",
  "m", "n", "p", "q", "r", "s", "t", "v", "x"
]

const van = [
  "a", "ai", "ao", "an", "ang", "am", "ăn", "ăng", "âu",
  "ia", "iê", "oa", "oe", "oi", "ua", "uô", "ưa"
]

const TONE_INFO = [
  { key: "ngang", mark: "—", name: "ngang", cls: "ngang" },
  { key: "sac",   mark: "´", name: "sắc",   cls: "sac" },
  { key: "huyen", mark: "`", name: "huyền", cls: "huyen" },
  { key: "hoi",   mark: "?", name: "hỏi",   cls: "hoi" },
  { key: "nga",   mark: "~", name: "ngã",   cls: "nga" },
  { key: "nang",  mark: ".", name: "nặng",  cls: "nang" }
]

const tones = [
  ["a","ă","â","e","ê","i","o","ô","ơ","u","ư","y"],
  ["á","ắ","ấ","é","ế","í","ó","ố","ớ","ú","ứ","ý"],
  ["à","ằ","ầ","è","ề","ì","ò","ồ","ờ","ù","ừ","ỳ"],
  ["ả","ẳ","ẩ","ẻ","ể","ỉ","ỏ","ổ","ở","ủ","ử","ỷ"],
  ["ã","ẵ","ẫ","ẽ","ễ","ĩ","õ","ỗ","ỡ","ũ","ữ","ỹ"],
  ["ạ","ặ","ậ","ẹ","ệ","ị","ọ","ộ","ợ","ụ","ự","ỵ"]
]

function addTone(word, t){
  for (let i = 0; i < tones[0].length; i++){
    if (word.includes(tones[0][i])){
      return word.replace(tones[0][i], tones[t][i])
    }
  }
  return word
}

/* ===================== SPEECH ===================== */
/*
  Chiến lược:
  1) Thử Puter.js (puter.ai.txt2speech, provider OpenAI) - chạy qua
     server thật, không cần API key, không bị lỗi CORS như cách gọi
     trực tiếp endpoint Google Translate. AWS Polly (mặc định của
     Puter) không có giọng tiếng Việt nên phải chỉ định OpenAI.
  2) Nếu Puter lỗi hoặc chưa load xong -> fallback sang Web Speech API
     (giọng có sẵn trên máy), nếu máy có cài giọng tiếng Việt.
  3) Cache audio đã tạo để bấm lại không cần gọi lại server.
*/

const audioCache = new Map()
let cachedVoices = []

function loadVoices(){
  cachedVoices = speechSynthesis.getVoices()
}
if ("onvoiceschanged" in speechSynthesis) {
  speechSynthesis.onvoiceschanged = loadVoices
}
loadVoices()

function speakWithBrowser(text){
  let viVoice = cachedVoices.find(v => v.lang.toLowerCase().startsWith("vi"))
  if (!viVoice) return false

  speechSynthesis.cancel()
  let u = new SpeechSynthesisUtterance(text)
  u.lang = "vi-VN"
  u.rate = .85
  u.voice = viVoice
  speechSynthesis.speak(u)
  return true
}

async function speak(text, onStart, onEnd){
  if (onStart) onStart()

  // Đã có sẵn trong cache -> phát ngay, không gọi lại server
  if (audioCache.has(text)) {
    let audio = audioCache.get(text)
    audio.currentTime = 0
    audio.play()
    audio.onended = () => { if (onEnd) onEnd() }
    return
  }

  try {
    if (typeof puter === "undefined") throw new Error("puter chưa load")

    // AWS Polly (mặc định của Puter) KHÔNG có giọng tiếng Việt,
    // nên phải chỉ định provider OpenAI - model này hỗ trợ tiếng Việt tốt.
    let audio = await puter.ai.txt2speech(text, {
      provider: "openai",
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      response_format: "mp3",
      instructions: "Đọc rõ ràng, chậm, đúng giọng tiếng Việt, không pha giọng nước ngoài."
    })

    audioCache.set(text, audio)
    audio.onended = () => { if (onEnd) onEnd() }
    audio.play()

  } catch (err) {
    console.warn("Puter TTS lỗi, thử giọng có sẵn của máy:", err)

    let ok = speakWithBrowser(text)
    if (!ok) {
      alert(
        "Không thể phát âm thanh.\n\n" +
        "Máy này không có giọng tiếng Việt cài sẵn, và dịch vụ đọc " +
        "online (Puter) cũng không phản hồi được — có thể do mất " +
        "kết nối mạng hoặc dịch vụ đang quá tải. Hãy thử lại sau."
      )
    }
    if (onEnd) onEnd()
  }
}

/* ===================== TONE POPUP ===================== */

function closeMenu(){
  document.querySelectorAll(".toneMenu").forEach(x => x.remove())
}

function openMenu(event, base){
  event.stopPropagation()
  closeMenu()

  let menu = document.createElement("div")
  menu.className = "toneMenu"

  TONE_INFO.forEach((tone, t) => {
    let word = addTone(base, t)

    let row = document.createElement("div")
    row.className = "toneItem"
    row.innerHTML = `🔊 ${word} <span class="tone-tag">${tone.name}</span>`

    row.onclick = (e) => {
      e.stopPropagation()
      row.classList.add("loading")
      speak(word, null, () => row.classList.remove("loading"))
    }

    menu.appendChild(row)
  })

  document.body.appendChild(menu)

  let menuWidth = 170
  let left = event.pageX
  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 10
  }
  menu.style.left = left + "px"
  menu.style.top = (event.pageY + 8) + "px"
}

document.addEventListener("click", e => {
  if (!e.target.closest(".cell") && !e.target.closest(".toneMenu")) {
    closeMenu()
  }
})

/* ===================== BUILD TABLE ===================== */

function draw(){
  let html = "<table><thead><tr>"
  html += `<th class="corner">Âm đầu →<br><b>Vần ↓</b></th>`

  van.forEach(v => {
    html += `<th>${v}</th>`
  })
  html += "</tr></thead><tbody>"

  amDau.forEach(d => {
    html += "<tr>"
    html += `<th>${d || "(không có)"}</th>`

    van.forEach(v => {
      let word = d + v
      html += `<td class="cell" data-word="${word}">${word}</td>`
    })

    html += "</tr>"
  })

  html += "</tbody></table>"
  document.getElementById("table").innerHTML = html

  document.querySelectorAll("td.cell").forEach(cell => {
    cell.addEventListener("click", (e) => {
      openMenu(e, cell.dataset.word)
    })
  })
}

/* ===================== TONE LEGEND + CARDS ===================== */

function buildToneLegend(){
  let legend = document.getElementById("tone-legend-inline")
  let html = `<span class="legend-label">Thanh điệu:</span>`
  TONE_INFO.forEach(t => {
    html += `<span class="legend-item"><span class="legend-mark">${t.mark}</span> ${t.name}</span>`
  })
  legend.innerHTML = html
}

function buildToneCards(){
  let wrap = document.getElementById("tone-cards")
  let base = "ma"
  let html = ""

  TONE_INFO.forEach((t, i) => {
    let word = addTone(base, i)
    html += `
      <div class="tone-card ${t.cls}" data-word="${word}">
        <div class="tc-word">${word}</div>
        <div class="tc-mark">${t.mark}</div>
        <div class="tc-name">${t.name}</div>
      </div>
    `
  })

  wrap.innerHTML = html

  wrap.querySelectorAll(".tone-card").forEach(card => {
    card.addEventListener("click", () => speak(card.dataset.word))
  })
}

/* ===================== TABS ===================== */

document.getElementById("tab-guide").addEventListener("click", () => {
  document.querySelector(".bottom-panels").scrollIntoView({ behavior: "smooth" })
  document.getElementById("tab-guide").classList.add("active")
  document.getElementById("tab-table").classList.remove("active")
})

document.getElementById("tab-table").addEventListener("click", () => {
  document.getElementById("table-wrap").scrollIntoView({ behavior: "smooth" })
  document.getElementById("tab-table").classList.add("active")
  document.getElementById("tab-guide").classList.remove("active")
})

/* ===================== INIT ===================== */

draw()
buildToneLegend()
buildToneCards()
