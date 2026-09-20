# Full assembly script for Old Mountain Works Complete Overhaul
import os

with open('old-mountain-works.original.html', 'r', encoding='utf-8') as f:
    orig = f.read()

script_start = orig.find('<script>') + len('<script>')
matter_end = orig.find('var u=L0(z0(),1);') + len('var u=L0(z0(),1);')
matter_bundle = orig[script_start:matter_end]

with open('build_full_overhaul.py', 'r', encoding='utf-8') as f:
    setup_code = f.read()

head_start = setup_code.find('html_head = """') + len('html_head = """')
head_end = setup_code.find('"""\n\nhtml_tail = """')
html_head = setup_code[head_start:head_end]

tail_start = setup_code.find('html_tail = """') + len('html_tail = """')
tail_end = setup_code.rfind('"""')
html_tail = setup_code[tail_start:tail_end]

print("Matter bundle length:", len(matter_bundle))
print("HTML head length:", len(html_head))
print("HTML tail length:", len(html_tail))
