import re,sys,os,urllib.request,urllib.parse,html
base="https://sourceforge.net/p/hodoku/code/HEAD/tree/"
out=sys.argv[2]; root=sys.argv[1]
def get(u,binary=False):
    for _ in range(4):
        try:
            d=urllib.request.urlopen(u,timeout=60).read()
            # SourceForge sometimes appends an HTML error page to a raw file
            if b'<title>Server Error</title>' in d[-1500:]:
                raise IOError('server error page in response')
            return d if binary else d.decode('utf8','ignore')
        except Exception as e: err=e
    print("FAIL",u,err,file=sys.stderr); return None
def walk(p):
    s=get(base+p+"/")
    if s is None: return
    t=s[s.find('<tbody>'):s.find('</tbody>')]
    for m in re.finditer(r'<a class="icon" href="([^"]+)" rel="nofollow" title="[^"]*"><i class="fa (fa-folder|fa-file[^"]*)"',t):
        name=html.unescape(m.group(1)); q=p+"/"+name
        if 'folder' in m.group(2): walk(q)
        else:
            d=get(base+urllib.parse.quote(q)+"?format=raw",True)
            if d is None: continue
            f=os.path.join(out,q); os.makedirs(os.path.dirname(f),exist_ok=True)
            open(f,'wb').write(d); print(q,len(d),flush=True)
walk(root)
