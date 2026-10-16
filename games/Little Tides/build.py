"""Bundles js/*.js (ES modules) into js/bundle.js, a classic script that also works from file://.
Run: python build.py   (only needed after editing files in js/)"""
import re, os, glob
D='js'
mods={}
for f in glob.glob(D+'/*.js'):
    n=os.path.basename(f)
    if n=='bundle.js': continue
    mods[n]=open(f,encoding='utf8').read()
imp=re.compile(r"import\s+(?:(\*\s+as\s+(\w+))|\{([^}]*)\})\s+from\s+'\./([\w-]+\.js)';?",re.S)
deps={}
out={}
for n,src in mods.items():
    ds=[]
    def r(m):
        ds.append(m.group(4))
        if m.group(2): return f"const {m.group(2)} = __req('{m.group(4)}');"
        names=[x.strip() for x in m.group(3).split(',') if x.strip()]
        names=[x.replace(' as ',': ') for x in names]
        return "const { "+', '.join(names)+f" }} = __req('{m.group(4)}');"
    src=imp.sub(r,src)
    exps=[]
    def e(m):
        exps.append(m.group(2)); return m.group(1)+' '+m.group(2)
    src=re.sub(r"^export\s+((?:const|let|function|class))\s+(\w+)",lambda m:(exps.append(m.group(2)) or m.group(1)+' '+m.group(2)),src,flags=re.M)
    def e2(m):
        for x in m.group(1).split(','):
            x=x.strip()
            if x: exps.append(x)
        return ''
    src=re.sub(r"^export\s*\{([^}]*)\};?",e2,src,flags=re.M)
    assert 'import ' not in re.sub(r'//.*','',src) or True
    deps[n]=ds; out[n]=(src,exps)
order=[];seen=set()
def visit(n,stack=()):
    if n in seen: return
    assert n not in stack,('cycle',stack,n)
    for d in deps[n]: visit(d,stack+(n,))
    seen.add(n); order.append(n)
for n in sorted(mods):
    if n!='main.js': visit(n)
visit('main.js')
b=["(function(){'use strict';","const __mods={},__cache={};","function __req(n){ if(!__cache[n]){ const ex={}; __cache[n]=ex; __mods[n](ex); } return __cache[n]; }"]
for n in order:
    src,exps=out[n]
    b.append(f"__mods['{n}']=function(__ex){{\n{src}\n"+(f"Object.assign(__ex,{{{', '.join(exps)}}});" if exps else '')+"\n};")
b.append("__req('main.js');\n})();")
open(D+'/bundle.js','w',encoding='utf8').write('\n'.join(b))
print('bundled',len(order),'modules')
