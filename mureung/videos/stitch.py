import os, sys, cv2, numpy as np
d=sys.argv[1]; out=sys.argv[2]
fs=sorted(os.listdir(d)); imgs={i+1:cv2.imread(os.path.join(d,f)) for i,f in enumerate(fs)}
order=[3,1,4,2]   # 왼쪽 → 오른쪽 (두루마리 끝 → 시작)
def match(A,B):
    # A의 오른쪽, B의 왼쪽에서 특징점 맞추기 → B를 A 좌표로 옮기는 변환
    hA,wA=A.shape[:2]; hB,wB=B.shape[:2]
    a=A[:, int(wA*.55):]; b=B[:, :int(wB*.45)]
    orb=cv2.SIFT_create(4000)
    ka,da=orb.detectAndCompute(cv2.cvtColor(a,cv2.COLOR_BGR2GRAY),None)
    kb,db=orb.detectAndCompute(cv2.cvtColor(b,cv2.COLOR_BGR2GRAY),None)
    m=cv2.BFMatcher().knnMatch(db,da,k=2); good=[x for x,y in m if x.distance<.7*y.distance]
    pb=np.float32([kb[g.queryIdx].pt for g in good]); pa=np.float32([ka[g.trainIdx].pt for g in good]); pa[:,0]+=int(wA*.55)
    M,inl=cv2.estimateAffinePartial2D(pb,pa,method=cv2.RANSAC,ransacReprojThreshold=3)
    inl=inl.ravel().astype(bool); P=pb[inl]; Q=pa[inl]
    # 회전 없이: 크기 + 이동만
    Pm=P.mean(0); Qm=Q.mean(0); sc=(((P-Pm)*(Q-Qm)).sum())/(((P-Pm)**2).sum()); t=Qm-sc*Pm
    M=np.array([[sc,0,t[0]],[0,sc,t[1]]],np.float64)
    print('matches',len(good),'inliers',int(inl.sum()),'scale %.4f'%np.hypot(M[0,0],M[1,0]),'tx %.1f ty %.1f'%(M[0,2],M[1,2]))
    return M
# 누적 변환: 모든 조각을 첫 조각(3번) 좌표로
T=[np.eye(3)]
for i in range(3):
    M=match(imgs[order[i]],imgs[order[i+1]]); M3=np.vstack([M,[0,0,1]]); T.append(T[-1]@M3)
H=max(im.shape[0] for im in imgs.values())
corners=[]
for t,k in zip(T,order):
    h,w=imgs[k].shape[:2]; c=np.array([[0,0,1],[w,0,1],[0,h,1],[w,h,1]]).T; corners.append((t@c)[:2])
allc=np.hstack(corners); x0,y0=allc.min(1); x1,y1=allc.max(1)
W=int(np.ceil(x1-x0)); Hh=int(np.ceil(y1-y0)); off=np.array([[1,0,-x0],[0,1,-y0],[0,0,1]])
pano=np.zeros((Hh,W,3),np.uint8); acc=np.zeros((Hh,W),np.float32); col=np.zeros((Hh,W,3),np.float32)
for t,k in zip(T,order):
    im=imgs[k]; h,w=im.shape[:2]
    Mw=(off@t)[:2]
    warped=cv2.warpAffine(im,Mw,(W,Hh),flags=cv2.INTER_LANCZOS4)
    # 이음새는 가장자리로 갈수록 약하게 (부드럽게 섞기)
    ww=np.minimum(np.arange(w)+1,w-np.arange(w)).astype(np.float32); ww=np.minimum(ww/120.,1)
    wm=np.tile(ww,(h,1)); wmw=cv2.warpAffine(wm,Mw,(W,Hh))
    col+=warped.astype(np.float32)*wmw[...,None]; acc+=wmw
pano=(col/np.maximum(acc,1e-3)[...,None]).clip(0,255).astype(np.uint8)
print('pano',pano.shape, 'offsets', [ (off@t)[:2,2].round(1).tolist() for t in T])
cv2.imwrite(out,pano,[cv2.IMWRITE_JPEG_QUALITY,92])
