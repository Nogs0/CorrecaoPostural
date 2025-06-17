import cv2
import mediapipe as mp
import numpy as np
import math

def calcularAngulo(a, b, c):
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)

    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians*180.0/np.pi)    
    
    # Garante que o ângulo esteja entre 0 e 180
    if angle > 180.0:
        angle = 360 - angle
        
    return angle 

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

video_path_in = '../agachamento_eu4.mp4'
video_path_out = '../video_processado.mp4' # Nome do arquivo de saída

videoVertical = True;

cap = cv2.VideoCapture(video_path_in)

if not cap.isOpened():
    print(f"Erro ao abrir o arquivo de vídeo: {video_path_in}")
else:
    # Pega as propriedades do vídeo original (largura, altura, FPS)
    
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if videoVertical:
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    
    fps = int(cap.get(cv2.CAP_PROP_FPS))

    # Define o codec e cria o objeto VideoWriter
    fourcc = cv2.VideoWriter_fourcc(*'mp4v') # Codec para .mp4
    out = cv2.VideoWriter(video_path_out, fourcc, fps, (frame_width, frame_height))
    contadorDeRepeticoes = 0
    
    anguloMinimoJoelho = 180
    statusDoAgachamento = 'UP'
    
    anguloMinimoTronco = 180

    with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break

            if videoVertical:
                frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)

            height, width, _ = frame.shape
            # Processa o frame
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(frame_rgb)
            
            if results.pose_landmarks: 
            
                landmarks = results.pose_landmarks.landmark
                
                joelho_dir = landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value]
                joelho_dir_x = int(joelho_dir.x * width)
                joelho_dir_y = int(joelho_dir.y * height)
                
                ombro_dir = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
                ombro_dir_x = int(ombro_dir.x * width)
                ombro_dir_y = int(ombro_dir.y * height)
                
                quadril_dir = landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value]
                quadril_dir_x = int(quadril_dir.x * width)
                quadril_dir_y = int(quadril_dir.y * height)
                
                tornozelo_dir = landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value]
                tornozelo_dir_x = int(tornozelo_dir.x * width)
                tornozelo_dir_y = int(tornozelo_dir.y * height)
                
                dedao_dir = landmarks[mp_pose.PoseLandmark.RIGHT_FOOT_INDEX.value]
                dedao_dir_x = int(dedao_dir.x * width)
                dedao_dir_y = int(dedao_dir.y * height)
                
                anguloJoelho = calcularAngulo([quadril_dir_x, quadril_dir_y], [joelho_dir_x, joelho_dir_y], [tornozelo_dir_x, tornozelo_dir_y])
                pontoVerticalQuadril = (quadril_dir_x, quadril_dir_y + 0.5)
                anguloTroncoRelVertical = calcularAngulo([ombro_dir_x, ombro_dir_y], [quadril_dir_x, quadril_dir_y], pontoVerticalQuadril)
                anguloTornozelo = calcularAngulo([joelho_dir_x, joelho_dir_y], [tornozelo_dir_x, tornozelo_dir_y], [dedao_dir_x, dedao_dir_y])
                
                threshold_angle = 170 # Limiar para ver se a pessoa está em pé 
                
                # Lógica de transição de estados
                if anguloJoelho > threshold_angle and statusDoAgachamento == 'DOWN':
                    statusDoAgachamento = 'UP'
                    contadorDeRepeticoes += 1

                if anguloJoelho < threshold_angle and statusDoAgachamento == 'UP':
                    statusDoAgachamento = 'DOWN'
                    # Começou uma nova repetição, reseta o ângulo mínimo
                    anguloMinimoJoelho = 180
                    anguloMinimoTronco = 180

                # Lógica para encontrar o ângulo mínimo durante a fase 'DOWN'
                if statusDoAgachamento == 'DOWN':
                    if anguloJoelho < anguloMinimoJoelho:
                        anguloMinimoJoelho = anguloJoelho
                    if anguloTroncoRelVertical < anguloMinimoTronco:
                        anguloMinimoTronco = anguloTroncoRelVertical

                # Caixa do contador
                cv2.rectangle(frame, (0, 0), (180, 120), (245, 117, 16), -1)                
                # Texto do contador
                cv2.putText(frame, 'REPETICOES', (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 1, cv2.LINE_AA)
                cv2.putText(frame, str(contadorDeRepeticoes), (72, 90), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3, cv2.LINE_AA)
                    
                cor_feedback = (0, 255, 0)
                if anguloTroncoRelVertical < 135:
                    cor_feedback = (0, 0, 255)    
                                
                cv2.putText(frame, f"{anguloTroncoRelVertical:.2f}", (quadril_dir_x, quadril_dir_y), cv2.FONT_HERSHEY_SIMPLEX, 1, cor_feedback, 2, cv2.LINE_AA)
                
                cor_feedback = (0, 255, 0)
                if anguloJoelho < 60:
                    cor_feedback = (0, 0, 255)  
                cv2.putText(frame, f"{anguloJoelho:.2f}", (joelho_dir_x, joelho_dir_y), cv2.FONT_HERSHEY_SIMPLEX, 1, cor_feedback, 2, cv2.LINE_AA)
                
                cor_feedback = (0, 255, 0)
                if anguloTornozelo < 45:
                    cor_feedback = (0, 0, 255)  
                cv2.putText(frame, f"{anguloTornozelo:.2f}", (tornozelo_dir_x, tornozelo_dir_y), cv2.FONT_HERSHEY_SIMPLEX, 1, cor_feedback, 2, cv2.LINE_AA)

            out.write(frame)

            cv2.imshow('Processando Vídeo...', frame)
            
            if cv2.waitKey(20) & 0xFF == 27: # Pressione ESC para sair
                break

print(f"Processamento concluído! Vídeo salvo em: {video_path_out}")

# Libera os recursos
cap.release()
out.release() # --- NOVO: LIBERA O WRITER ---
cv2.destroyAllWindows()