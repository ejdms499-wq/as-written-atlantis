# 장면 움직임(광학 흐름)을 재서, 스크롤 1칸당 화면이 움직이는 양이 일정하도록 스크롤→영상시간 표를 만든다.
import re, json, numpy as np, sys
html_path=sys.argv[1]; m=np.load('/tmp/motion.npy')   # 프레임 사이 움직임(24fps)
FPS=24; N=len(m)+1; DUR=N/FPS
k=np.exp(-0.5*(np.arange(-24,25)/8.0)**2); k/=k.sum()
ms=np.convolve(np.pad(m,24,mode='edge'),k,'same')[24:-24]
F=0.9                                           # 거의 멈춘 장면도 이 정도 속도로는 지나가게
mot=np.maximum(ms,F)
# 글 블록: (id, 맞춰야 할 영상 시각)
A=[('c1',1.4),('c2',5.3),('c3',8.3),('c4',11.7),('c5a',13.0),('c5b',14.3),('c6',15.1),('c7',16.9),('c8',19.6),('c9',22.0),
   ('c10',23.6),('c11',28.3),('c12',29.3),('c13',31.9),('c14',32.6),('c15',33.3),('c16',34.0),('c17',34.6),('c18',35.1),
   ('c19',36.6),('c20',38.7),('c21',40.4),('c22',41.7),('c23',44.2),('c24',46.4)]
html=open(html_path,encoding='utf-8').read()
def chars(i):
    b=re.search(r'id="%s"[^>]*>(.*?)</div>'%i,html,re.S).group(1)
    p=re.findall(r'<p[^>]*>(.*?)</p>|<span class="title"[^>]*>(.*?)</span>',b,re.S)
    t=''.join(x or y for x,y in p); return len(re.sub(r'<[^>]+>|\s','',t))
tot_motion_screens=12.0; per_char=0.0125; sig=0.8*FPS
cost=mot/mot.sum()*tot_motion_screens
t=np.arange(N-1)/FPS
for i,a in A:
    R=max(14,chars(i))*per_char
    g=np.exp(-0.5*((t-a)*FPS/sig)**2); g/=g.sum(); cost=cost+R*g
INTRO=1.1; OUTRO=0.5                            # 화면 수
Ctot=cost.sum()+INTRO+OUTRO
C=np.concatenate([[0],np.cumsum(cost)])
def S_of_t(tt): return (INTRO+np.interp(tt*FPS,np.arange(N),C))/Ctot
s_intro=INTRO/Ctot
# MAP: 0.25초마다 한 칸
pts=[(0,0)]+[(S_of_t(x),x) for x in np.arange(0,DUR-1e-6,0.25)]+[(S_of_t(DUR-1/FPS),DUR-1/FPS),(1,DUR-1/FPS)]
MAP=[[round(a[0],5),round(b[0],5),round(a[1],3),round(b[1],3)] for a,b in zip(pts,pts[1:])]
# 글 상자 구간: 앞뒤 블록과 겹치지 않게 가운데서 나눔
cen=[S_of_t(a) for _,a in A]; B=[['b0',-1,round(s_intro*0.85,4)]]
for j,(i,a) in enumerate(A):
    lo=S_of_t(a-0.7) if j==0 else max(S_of_t(a-1.0),(cen[j-1]+cen[j])/2+.003)
    hi=9 if i=='c24' else min(S_of_t(a+1.0),(cen[j]+cen[j+1])/2-.003)
    if j==0: lo=max(lo,s_intro*0.9)
    B.append([i,round(lo,4),round(hi,4) if hi<9 else 9])
K=dict(reveal=S_of_t(21.5),caveA=S_of_t(15.2),villA=S_of_t(21.4),villB=S_of_t(35.2),fogA=S_of_t(35.6),
       cutA=B[[b[0] for b in B].index('c18')][1]-.004,cutB=B[[b[0] for b in B].index('c18')][2]+.006,
       quietA=B[[b[0] for b in B].index('c21')][1],endA=B[[b[0] for b in B].index('c24')][1],dS=S_of_t(43.4),dT=DUR-1/FPS,lostT0=41.2)
STOPS=[['시내',0],['복숭아숲',S_of_t(3.6)],['산의 입구',S_of_t(10.4)],['좁은 굴',S_of_t(16.4)],['마을',S_of_t(21.3)],['떠남',S_of_t(34.3)],['길을 잃음',S_of_t(40.0)]]
out=dict(MAP=MAP,BLOCKS=B,STOPS=[[a,round(b,4)] for a,b in STOPS],K={k:round(v,4) for k,v in K.items()},screens=round(Ctot,1),NF=None)
json.dump(out,open('/tmp/gen.json','w'),ensure_ascii=False)
print('screens',round(Ctot,1),'intro',round(s_intro,3)); print(K)
for b in B: print(b)
# 화면 속도 고르기 확인: 스크롤 1% 당 움직임
ss=np.linspace(0,1,201); tt=np.interp(ss,[p[0] for p in pts],[p[1] for p in pts])
v=[ms[min(len(ms)-1,int(x*FPS))]*(tt[i+1]-tt[i])*FPS for i,x in enumerate(tt[:-1])]
print('motion per half-percent scroll: median %.2f  p90 %.2f  max %.2f'%(np.median(v),np.percentile(v,90),max(v)))
