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

video_path_in = 'agachamento.mp4'
video_path_out = 'video_processado.mp4' # Nome do arquivo de saída

cap = cv2.VideoCapture(video_path_in)

if not cap.isOpened():
    print(f"Erro ao abrir o arquivo de vídeo: {video_path_in}")
else:
    # Pega as propriedades do vídeo original (largura, altura, FPS)
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
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

            height, width, _ = frame.shape
            # Processa o frame
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(frame_rgb)
            
            # Desenha a pose no frame
            if results.pose_landmarks:
                # 1. Defina a lista dos pontos que você quer desenhar
                pontos_de_interesse = [
                    mp_pose.PoseLandmark.LEFT_SHOULDER, 
                    mp_pose.PoseLandmark.LEFT_ELBOW,
                    mp_pose.PoseLandmark.LEFT_WRIST,
                    mp_pose.PoseLandmark.LEFT_HIP,
                    mp_pose.PoseLandmark.LEFT_KNEE,
                    mp_pose.PoseLandmark.LEFT_ANKLE,
                ]

                # 2. Percorra a lista de pontos de interesse e desenhe cada um
                for landmark_enum in pontos_de_interesse:
                    # Pega o objeto do landmark correspondente da lista de resultados
                    landmark = results.pose_landmarks.landmark[landmark_enum.value]
                    
                    # Converte as coordenadas normalizadas para pixels
                    cx = int(landmark.x * width)
                    cy = int(landmark.y * height)
                    
                    # Desenha o círculo no ponto, apenas se ele estiver visível
                    if landmark.visibility > 0.5:
                        cv2.circle(frame, (cx, cy), radius=5, color=(0, 255, 0), thickness=-1)
                
                conexoes_de_interesse = [
                    # Tronco
                    (mp_pose.PoseLandmark.LEFT_SHOULDER, mp_pose.PoseLandmark.LEFT_HIP),
                    # Braços
                    (mp_pose.PoseLandmark.LEFT_SHOULDER, mp_pose.PoseLandmark.LEFT_ELBOW),
                    (mp_pose.PoseLandmark.LEFT_ELBOW, mp_pose.PoseLandmark.LEFT_WRIST),
                    # Pernas
                    (mp_pose.PoseLandmark.LEFT_HIP, mp_pose.PoseLandmark.LEFT_KNEE),
                    (mp_pose.PoseLandmark.LEFT_KNEE, mp_pose.PoseLandmark.LEFT_ANKLE),
                ]

                # 2. Percorra a lista de conexões e desenhe cada linha
                for conexao in conexoes_de_interesse:
                    ponto_inicial = results.pose_landmarks.landmark[conexao[0].value]
                    ponto_final = results.pose_landmarks.landmark[conexao[1].value]

                    # Converte para coordenadas de pixel
                    p1_x, p1_y = int(ponto_inicial.x * width), int(ponto_inicial.y * height)
                    p2_x, p2_y = int(ponto_final.x * width), int(ponto_final.y * height)
                    # Desenha a linha se ambos os pontos estiverem visíveis
                    if ponto_inicial.visibility > 0.5 and ponto_final.visibility > 0.5:
                        cv2.line(frame, (p1_x, p1_y), (p2_x, p2_y), color=(255, 255, 0), thickness=2)    
            
                landmarks = results.pose_landmarks.landmark
                
                joelho_esq = landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value]
                joelho_esq_x = int(joelho_esq.x * width)
                joelho_esq_y = int(joelho_esq.y * height)
                joelho_esq_visibility = joelho_esq.visibility
                
                cotovelo_esq = landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value]
                cotovelo_esq_x = int(cotovelo_esq.x * width)
                cotovelo_esq_y = int(cotovelo_esq.y * height)
                cotovelo_esq_visibility = cotovelo_esq.visibility
                
                ombro_esq = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
                ombro_esq_x = int(ombro_esq.x * width)
                ombro_esq_y = int(ombro_esq.y * height)
                ombro_esq_visibility = ombro_esq.visibility
                
                quadril_esq = landmarks[mp_pose.PoseLandmark.LEFT_HIP.value]
                quadril_esq_x = int(quadril_esq.x * width)
                quadril_esq_y = int(quadril_esq.y * height)
                quadril_esq_visibility = quadril_esq.visibility
                
                tornozelo_esq = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value]
                tornozelo_esq_x = int(tornozelo_esq.x * width)
                tornozelo_esq_y = int(tornozelo_esq.y * height)
                tornozelo_esq_visibility = tornozelo_esq.visibility
                
                dedao_esq = landmarks[mp_pose.PoseLandmark.LEFT_FOOT_INDEX.value]
                dedao_esq_x = int(dedao_esq.x * width)
                dedao_esq_y = int(dedao_esq.y * height)
                dedao_esq_visibility = dedao_esq.visibility
                
                anguloJoelho = calcularAngulo([quadril_esq_x, quadril_esq_y], [joelho_esq_x, joelho_esq_y], [tornozelo_esq_x, tornozelo_esq_y])
                anguloTronco = calcularAngulo([ombro_esq_x, ombro_esq_y], [quadril_esq_x, quadril_esq_y], [joelho_esq_x, joelho_esq_y])
                
                threshold_angle = 160 # Limiar para ver se a pessoa está em pé 
                
                # Lógica de transição de estados
                if anguloJoelho > threshold_angle and statusDoAgachamento == 'DOWN':
                    statusDoAgachamento = 'UP'
                    contadorDeRepeticoes += 1
                    # A repetição acabou, o valor em anguloMinimoJoelho é o final
                    print(f"Repetição {contadorDeRepeticoes} | Ângulo Mín Joelho: {anguloMinimoJoelho:.2f} | Ângulo Mín Tronco: {anguloMinimoTronco:.2f}")

                if anguloJoelho < threshold_angle and statusDoAgachamento == 'UP':
                    statusDoAgachamento = 'DOWN'
                    # Começou uma nova repetição, reseta o ângulo mínimo
                    anguloMinimoJoelho = 180
                    anguloMinimoTronco = 180

                # Lógica para encontrar o ângulo mínimo durante a fase 'DOWN'
                if statusDoAgachamento == 'DOWN':
                    if anguloJoelho < anguloMinimoJoelho:
                        anguloMinimoJoelho = anguloJoelho
                    if anguloTronco < anguloMinimoTronco:
                        anguloMinimoTronco = anguloTronco

                # --- VISUALIZAÇÃO DO STATUS NA TELA ---
                # Caixa do contador
                cv2.rectangle(frame, (0, 0), (200, 120), (245, 117, 16), -1)                
                # Texto do contador
                cv2.putText(frame, 'REPETICOES', (15, 25), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 1, cv2.LINE_AA)
                cv2.putText(frame, str(contadorDeRepeticoes), (20, 90), 
                            cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3, cv2.LINE_AA)
                
                # Caixa do angulo mínimo joelho
                cv2.rectangle(frame, (width - 300, 0), (width, 120), (245, 117, 16), -1)

                # Texto do ângulo mínimo
                cv2.putText(frame, 'ANGULO MIN JOELHO', (width - 300, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 1, cv2.LINE_AA)
                cv2.putText(frame, f"{anguloMinimoJoelho:.1f}", (width - 300, 90), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3, cv2.LINE_AA)
                
                # Caixa do angulo mínimo tronco
                cv2.rectangle(frame, (width - 300, 200), (width, 320), (245, 117, 16), -1)
                
                cv2.putText(frame, 'ANGULO MIN TRONCO', (width - 300, 225), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 1, cv2.LINE_AA)
                cv2.putText(frame, f"{anguloMinimoTronco:.1f}", (width - 300, 290), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3, cv2.LINE_AA)
                 
                
                
                # anguloTronco = calcularAngulo([ombro_esq_x, ombro_esq_y], [quadril_esq_x, quadril_esq_y], [joelho_esq_x, joelho_esq_y])
                # anguloTronco_text = f"Angulo do Tronco: {anguloTronco:.2f}"
                # quadril_pixel = (int(quadril_esq_x * width), int(quadril_esq_y * height))
                
                # feedback = "Movimento correto"
                # cor_feedback = (0, 255, 0)
                # if anguloTronco < 100:
                #     feedback = "Inclinado demais"
                #     cor_feedback = (0, 0, 255)
                    
                # cv2.putText(frame, anguloTronco_text, (quadril_pixel[0] - 80, quadril_pixel[1] - 50), cv2.FONT_HERSHEY_SIMPLEX, 1, cor_feedback, 2, cv2.LINE_AA)
                
                # cv2.putText(frame, feedback, (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.5, cor_feedback, 2, cv2.LINE_AA)

            out.write(frame)

            cv2.imshow('Processando Vídeo...', frame)
            
            if cv2.waitKey(20) & 0xFF == 27: # Pressione ESC para sair
                break

print(f"Processamento concluído! Vídeo salvo em: {video_path_out}")

# Libera os recursos
cap.release()
out.release() # --- NOVO: LIBERA O WRITER ---
cv2.destroyAllWindows()