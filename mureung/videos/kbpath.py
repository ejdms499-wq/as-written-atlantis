# 사진 한 장 위를 천천히 움직이는 카메라 (부드러운 가감속, 확대/이동)
import sys, subprocess, numpy as np
from PIL import Image
src, out, dur = sys.argv[1], sys.argv[2], float(sys.argv[3]); keys=eval(sys.argv[4])  # [(t, subj_x, subj_y, zoom, place_x, place_y)]
OW,OH,FPS=1024,572,24
im=Image.open(src).convert('RGB'); W,H=im.size; S=2; big=im.resize((W*S,H*S),Image.LANCZOS)
def rect(k):
    t,sx,sy,z,px,py=k; w,h=W/z,H/z; x0=sx*W-px*w; y0=sy*H-py*h
    x0=min(max(x0,0),W-w); y0=min(max(y0,0),H-h); return np.array([x0+w/2,y0+h/2,np.log(z)])
R=[(k[0],rect(k)) for k in keys]
def at(t):
    for (ta,ra),(tb,rb) in zip(R,R[1:]):
        if t<=tb:
            u=(t-ta)/(tb-ta) if tb>ta else 1; u=u*u*(3-2*u); return ra+(rb-ra)*u
    return R[-1][1]
p=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{OW}x{OH}','-r',str(FPS),'-i','-','-c:v','libx264','-crf','16','-preset','veryfast','-pix_fmt','yuv420p',out],stdin=subprocess.PIPE)
for i in range(int(round(dur*FPS))):
    cx,cy,lz=at(i/FPS); z=np.exp(lz); w,h=W/z,H/z
    box=[(cx-w/2)*S,(cy-h/2)*S,(cx+w/2)*S,(cy+h/2)*S]
    fr=big.resize((OW,OH),Image.BICUBIC,box=box); p.stdin.write(fr.tobytes())
p.stdin.close(); p.wait()
