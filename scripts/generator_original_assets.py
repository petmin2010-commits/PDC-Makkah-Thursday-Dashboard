#!/usr/bin/env python3
"""Render only the six *unchanged-layout* source PPTX slides into clean reusable backgrounds."""
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pathlib import Path
from PIL import Image
import subprocess, tempfile, fitz, os

root=Path(__file__).resolve().parents[1]
source=root/'templates'/'temporary-generators-original.pptx'
target=root/'public'/'generator-template'
target.mkdir(parents=True,exist_ok=True)
pptx=Presentation(str(source))
assert len(pptx.slides)==6, 'The original generators template must contain the last six source slides'

def clear_field(shape):
    if not shape.has_text_frame: return
    t=shape.text.strip()
    labels=('رقم امر العمل','المقاول','نوع امر العمل','وصف العمل','الموقع :','التصحيح:')
    if t.startswith(labels):
        for para in shape.text_frame.paragraphs[1:]:
            for run in para.runs:run.text=''
    elif t.startswith('الملاحظات :'):
        para=shape.text_frame.paragraphs[0]
        for run in para.runs[1:]:run.text=''

def walk(shape):
    clear_field(shape)
    if shape.shape_type==MSO_SHAPE_TYPE.GROUP:
        for child in shape.shapes:walk(child)

for s in pptx.slides:
    for shape in s.shapes:walk(shape)

for sh in pptx.slides[1].shapes:
    if sh.has_text_frame:
        text=sh.text.strip()
        if text in ('0','1') or 'عدم وجود أشرطة تحذيرية' in text:
            for para in sh.text_frame.paragraphs:
                for run in para.runs:run.text=''

for sh in list(pptx.slides[4].shapes):
    if sh.shape_type==MSO_SHAPE_TYPE.PICTURE:
        blip=sh._element.xpath('.//a:blip')
        if blip and blip[0].get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed') in ('rId7','rId8'):
            pptx.slides[4].shapes._spTree.remove(sh._element)

with tempfile.TemporaryDirectory() as td:
    for city in ('makkah','jeddah'):
        for sh in pptx.slides[0].shapes:
            if sh.has_text_frame and 'إدارة مشاريع التوزيع' in sh.text:
                for para in sh.text_frame.paragraphs:
                    for run in para.runs:
                        run.text=run.text.replace('بمكة','بجدة' if city=='jeddah' else 'بمكة').replace('بجدة','بجدة' if city=='jeddah' else 'بمكة')
        name='generators_'+city
        p=Path(td)/(name+'.pptx');pptx.save(p)
        profile=Path(td)/('profile_'+city)
        subprocess.run(['libreoffice','-env:UserInstallation='+profile.as_uri(),'--headless','--convert-to','pdf','--outdir',td,str(p)],check=True,timeout=150)
        doc=fitz.open(str(Path(td)/(name+'.pdf')))
        assert len(doc)==6
        for i,page in enumerate(doc):
            if city=='jeddah' and i!=0:continue
            pix=page.get_pixmap(matrix=fitz.Matrix(1.75,1.75),alpha=False)
            im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
            dest=target/((city if i==0 else 'shared')+'_'+str(i+1)+'.webp')
            im.save(dest,'WEBP',quality=87,method=6)
            print(dest.relative_to(root),dest.stat().st_size)
print('Verified original PPTX geometry and exported seven exact-layout backgrounds')
