import {
    PoseLandmarker,
    FilesetResolver,
    DrawingUtils
} from "https://cdn.skypack.dev/@mediapipe/tasks-vision@0.10.0";

// Pega os elementos do HTML
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const repCountElement = document.getElementById("rep-count");
const depthFeedbackElement = document.getElementById("depth-feedback");
const postureFeedbackElement = document.getElementById("posture-feedback");

let appState = 'AGUARDANDO_USUARIO'; // Estados possíveis: 'AGUARDANDO_USUARIO', 'PREPARANDO', 'ANALISANDO', 'FINALIZADO'
let countdown = 5;

// Variáveis para a lógica do agachamento
let squatCounter = 0;
let squatState = 'UP';
let kneeAngleMin = 180;
let trunkAngleMin = 180;

// Configuração do MediaPipe PoseLandmarker
let poseLandmarker;

// Ombros (11,12), Quadris (23,24), Joelhos (25,26), Pontas dos Pés (29,30)
const PONTOS_NECESSARIOS = [11, 12, 23, 24, 25, 26, 29, 30];
const VISIBILITY_THRESHOLD = 0.7; // Limiar de confiança

async function createPoseLandmarker() {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 1
    });
    enableCam();
}
createPoseLandmarker();

// Função para ligar a webcam
function enableCam() {
    if (!poseLandmarker) {
        console.log("Aguardando o PoseLandmarker carregar...");
        return;
    }

    const constraints = { video: true };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    });
}

function startCountdown() {
    appState = 'PREPARANDO';

    const interval = setInterval(() => {
        countdown--;
        if (countdown < 1) {
            clearInterval(interval);
            appState = 'ANALISANDO'; // Muda o estado para começar a análise
            // Mostra os painéis de feedback novamente
            document.getElementById("feedbackContainer").style.display = 'flex';
        }
    }, 1000); // Executa a cada 1 segundo
}

// NOVO: Função principal que inicia o app
function startApp() {
    startCountdown(); // Inicia o contador
    predictWebcam();  // Inicia o loop de renderização do vídeo
}

// Função para calcular o ângulo (a mesma lógica do Python, traduzida)
function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
        angle = 360 - angle;
    }
    return angle;
}

function todosOsPontosEstaoVisiveis(landmarks) {
    for (const index of PONTOS_NECESSARIOS) {
        // Se algum dos pontos necessários não existir ou tiver baixa visibilidade, retorna falso
        if (!landmarks[index] || !(landmarks[index].x > 0 && landmarks[index].x < 1 && landmarks[index].y > 0 && landmarks[index].y < 1)) {
            return false;
        }
    }
    // Se todos os pontos passaram na verificação, retorna verdadeiro
    return true;
}

// O loop de predição principal
let lastVideoTime = -1;
async function predictWebcam() {
    // Ajusta o tamanho do canvas para o tamanho do vídeo
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);


    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
            const drawingUtils = new DrawingUtils(canvasCtx);
            if (appState === 'AGUARDANDO_USUARIO') {
                canvasCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
                canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
                canvasCtx.font = "bold 30px Arial";
                canvasCtx.fillStyle = "white";
                canvasCtx.textAlign = "center";
                canvasCtx.fillText("Posicione-se de lado", canvasElement.width / 2, canvasElement.height / 2 - 70);
                canvasCtx.fillText("para a câmera", canvasElement.width / 2, canvasElement.height / 2 - 40);
                canvasCtx.fillText("Ombros, quadris e pés", canvasElement.width / 2, canvasElement.height / 2 + 40);
                canvasCtx.fillText("devem estar visíveis", canvasElement.width / 2, canvasElement.height / 2 + 70);

                if (result.landmarks && result.landmarks.length > 0 && todosOsPontosEstaoVisiveis(result.landmarks[0]))
                    startCountdown();
            }
            else if (appState === 'PREPARANDO') {
                // Desenha a contagem regressiva na tela
                canvasCtx.fillStyle = "rgba(255, 255, 255, 0.3)";
                canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
                canvasCtx.font = "bold 150px Arial";
                canvasCtx.fillStyle = "#000";
                canvasCtx.textAlign = "center";
                canvasCtx.textBaseline = "middle";
                canvasCtx.fillText(countdown.toString(), canvasElement.width / 2, canvasElement.height / 2);

            } else if (appState === 'ANALISANDO') {
                if (result.landmarks && result.landmarks.length > 0) {
                    const landmarks = result.landmarks[0]; // Pega os landmarks da primeira pessoa detectada

                    // Lógica de análise do agachamento
                    const hip = landmarks[23]; // Quadril esquerdo
                    const knee = landmarks[25]; // Joelho esquerdo
                    const ankle = landmarks[27]; // Tornozelo esquerdo
                    const shoulder = landmarks[11]; // Ombro esquerdo

                    const kneeAngle = calculateAngle(hip, knee, ankle);
                    const verticalPointRelHip = {x: hip.x, y: hip.y + 0.5};
                    const trunkAngle = calculateAngle(shoulder, hip, verticalPointRelHip);
                    console.log(trunkAngle)
                    const thresholdAngle = 140;

                    // Lógica de estados UP/DOWN
                    if (kneeAngle > thresholdAngle && squatState === 'DOWN') {
                        squatState = 'UP';
                        squatCounter++;
                        const feedbackSobreImagem = document.querySelector('#fedbackSobreImagem');
                        // Feedback ao final da repetição
                        depthFeedbackElement.textContent = kneeAngleMin <= 90 ? 'BOM' : 'DESÇA +';

                        if (trunkAngleMin < 135) {
                            postureFeedbackElement.textContent = 'TRONCO!';
                            feedbackSobreImagem.innerHTML = 'TRONCO!';
                        }
                        else {
                            postureFeedbackElement.textContent = 'BOA';
                            feedbackSobreImagem.innerHTML = '';
                        }
                        // Reseta para a próxima repetição
                        kneeAngleMin = 180;
                        trunkAngleMin = 180;
                    }

                    if (kneeAngle < thresholdAngle && squatState === 'UP') {
                        squatState = 'DOWN';
                    }

                    if (squatState === 'DOWN') {
                        kneeAngleMin = Math.min(kneeAngleMin, kneeAngle);
                        trunkAngleMin = Math.min(trunkAngleMin, trunkAngle);
                    }

                    // Atualiza o contador de repetições na tela
                    repCountElement.textContent = squatCounter;
                    if (!todosOsPontosEstaoVisiveis(result.landmarks[0]))
                        appState = 'FINALIZADO';
                }
            }
        });
    }
    canvasCtx.restore();
    if (appState !== 'FINALIZADO') {
        window.requestAnimationFrame(predictWebcam);
    }
    else {
        document.querySelector('#buttonReiniciar').style.display = 'block';
        video.style.display = 'none';
        canvasCtx.fillStyle = "#d6f51c";
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.font = "bold 50px Arial";
        canvasCtx.fillStyle = "black";
        canvasCtx.textAlign = "center";
        canvasCtx.textBaseline = "middle";
        canvasCtx.fillText("Sessão Finalizada!", canvasElement.width / 2, canvasElement.height / 2);
    }
}