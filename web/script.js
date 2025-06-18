import {
    PoseLandmarker,
    FilesetResolver
} from "https://cdn.skypack.dev/@mediapipe/tasks-vision@0.10.0";

// Pega os elementos do HTML
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("outputCanvas");
const canvasCtx = canvasElement.getContext("2d");
const repCountElementSquat = document.getElementById("repCount");
const repCountElementCurl = document.getElementById("repCountRosca");
const depthFeedbackElement = document.getElementById("depthFeedback");
const postureFeedbackElement = document.getElementById("postureFeedback");
const containerFeedbackAgachamento = document.getElementById("containerFeedbackAgachamento");
const containerFeedbackRosca = document.getElementById("containerFeedbackRosca");
const analiseFeedbackRosca = document.getElementById("analiseFeedbackRosca");
const buttonReload = document.getElementById("buttonReload");

let appState = 'AGUARDANDO_USUARIO'; // Estados possíveis: 'AGUARDANDO_USUARIO', 'PREPARANDO', 'ANALISANDO', 'FINALIZADO'
let countdown = 5;

// Variáveis para a lógica do agachamento
let squatCounter = 0;
let squatState = 'UP';
let kneeAngleMin = 180;
let trunkAngleMin = 180;

//Variáveis para a lógica da rosca
let curlCounter = 0;
let curlState = 'DOWN';
let elbowAngleMin = 180;
let elbowAngleMax = 0;

// Configuração do MediaPipe PoseLandmarker
let poseLandmarker;
let exercicio;

// O MediaPipe Pose utiliza um enum para definir cada ponto no corpo
// Ombros (11,12), Quadris (23,24), Joelhos (25,26), Pontas dos Pés (29,30)
const PONTOS_NECESSARIOS_AGACHAMENTO = [11, 12, 23, 24, 25, 26, 29, 30];
// Ombros (11,12), Cotovelos (13,14), Pulsos (15,16)
const PONTOS_NECESSARIOS_ROSCA = [11, 12, 13, 14, 15, 16];

window.escolherExercicio = escolherExercicio;

function escolherExercicio(ex) {
    exercicio = ex;
    document.querySelector('#containerInicialOpcoes').style.display = 'none';
    document.querySelector('#containerAnalise').style.display = 'flex';
    if (exercicio === 0)
        containerFeedbackAgachamento.style.display = 'flex';
    else if (exercicio === 1)
        containerFeedbackRosca.style.display = 'flex';

    enableCam();
}

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
}
await createPoseLandmarker();

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
            if (exercicio == 0)
                containerFeedbackAgachamento.style.display = 'flex';
            else if (exercicio == 1)
                containerFeedbackRosca.style.display = 'flex';
        }
    }, 1000); // Executa a cada 1 segundo
}

function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
        angle = 360 - angle;
    }
    return angle;
}

function allPointsAreVisible(landmarks) {
    let pontosNecessarios = PONTOS_NECESSARIOS_AGACHAMENTO;
    if (exercicio === 1)
        pontosNecessarios = PONTOS_NECESSARIOS_ROSCA;

    for (const index of pontosNecessarios) {
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

            if (appState === 'AGUARDANDO_USUARIO') {
                canvasCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
                canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
                canvasCtx.font = "bold 30px Arial";
                canvasCtx.fillStyle = "white";
                canvasCtx.textAlign = "center";
                canvasCtx.fillText("Posicione-se de lado", canvasElement.width / 2, canvasElement.height / 2 - 70);
                canvasCtx.fillText("para a câmera", canvasElement.width / 2, canvasElement.height / 2 - 40);
                if (exercicio === 0) {
                    canvasCtx.fillText("Ombros, quadris e pés", canvasElement.width / 2, canvasElement.height / 2 + 40);
                    canvasCtx.fillText("devem estar visíveis", canvasElement.width / 2, canvasElement.height / 2 + 70);
                }
                else if (exercicio === 1) {
                    canvasCtx.fillText("Ombros, cotovelos e pulsos", canvasElement.width / 2, canvasElement.height / 2 + 40);
                    canvasCtx.fillText("devem estar visíveis", canvasElement.width / 2, canvasElement.height / 2 + 70);
                }

                if (result.landmarks && result.landmarks.length > 0 && allPointsAreVisible(result.landmarks[0], exercicio))
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
                    if (exercicio == 0) {
                        // Lógica de análise do agachamento
                        const hip = landmarks[23]; // Quadril esquerdo
                        const knee = landmarks[25]; // Joelho esquerdo
                        const ankle = landmarks[27]; // Tornozelo esquerdo
                        const shoulder = landmarks[11]; // Ombro esquerdo

                        const kneeAngle = calculateAngle(hip, knee, ankle);
                        const verticalPointRelHip = { x: hip.x, y: hip.y + 0.5 };
                        const trunkAngle = calculateAngle(shoulder, hip, verticalPointRelHip);
                        console.log(trunkAngle)
                        const thresholdAngle = 140;

                        // Controle de repetições
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
                        repCountElementSquat.textContent = squatCounter;
                        if (!allPointsAreVisible(result.landmarks[0], 0))
                            appState = 'FINALIZADO';
                    }
                    else if (exercicio == 1) {
                        // Lógica de análise da rosca
                        const shoulder = landmarks[12]; // Ombro direito
                        const elbow = landmarks[14];    // Cotovelo direito
                        const wrist = landmarks[16];    // Pulso direito

                        const currentElbowAngle = calculateAngle(shoulder, elbow, wrist);

                        const CONTRACTED_THRESHOLD = 90;  // Ângulo para considerar o braço 'UP'
                        const EXTENDED_THRESHOLD = 120; // Ângulo para considerar o braço 'DOWN'

                        // Controle de repetições
                        if (currentElbowAngle < CONTRACTED_THRESHOLD) {
                            curlState = 'UP';
                        }

                        // Transição de UP para DOWN (fim da repetição)
                        if (currentElbowAngle > EXTENDED_THRESHOLD && curlState === 'UP') {
                            curlState = 'DOWN';
                            curlCounter++;

                            if (elbowAngleMin > 60) {
                                analiseFeedbackRosca.innerHTML = "Contraia mais";
                            }
                            else if (elbowAngleMax < 160) {
                                analiseFeedbackRosca.innerHTML = "Estenda mais";
                            }
                            else
                                analiseFeedbackRosca.innerHTML = "Mantenha";

                            // Reseta os ângulos para a próxima repetição
                            elbowAngleMin = 180;
                            elbowAngleMax = 0;
                        }

                        // 4. Rastreia os ângulos mínimo e máximo durante a repetição
                        elbowAngleMin = Math.min(elbowAngleMin, currentElbowAngle);
                        elbowAngleMax = Math.max(elbowAngleMax, currentElbowAngle);

                        repCountElementCurl.textContent = curlCounter;
                    }
                }
            }
        });
    }

    canvasCtx.restore();
    if (appState !== 'FINALIZADO') {
        window.requestAnimationFrame(predictWebcam);
    }
    else {
        buttonReload.style.display = 'block';
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