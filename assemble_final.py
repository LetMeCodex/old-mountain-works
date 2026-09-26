import sys
import os

print("Running part generators...")
import gen_part1
import gen_part2
import gen_part3
import gen_part4
import gen_part5
import gen_part6

# Combine all engine parts
engine_parts = []
for i in range(1, 7):
    with open(f'engine_part{i}.js', 'r', encoding='utf-8') as f:
        engine_parts.append(f.read())

full_engine = '\n'.join(engine_parts)

with open('game_engine.js', 'w', encoding='utf-8') as f:
    f.write(full_engine)

print(f"game_engine.js generated: {len(full_engine)} bytes, {len(full_engine.splitlines())} lines.")

# Now assemble HTML
with open('old-mountain-works.original.html', 'r', encoding='utf-8') as f:
    orig = f.read()

script_start = orig.find('<script>') + len('<script>')
matter_end = orig.find('var u=L0(z0(),1);') + len('var u=L0(z0(),1);')
matter_bundle = orig[script_start:matter_end]

from build_full_overhaul import html_head, html_tail

full_html = html_head + matter_bundle + "\n" + full_engine + html_tail

# Write index.html, old-mountain-works.html, and old-mountain-works(1).html (and Downloads)
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(full_html)

with open('old-mountain-works.html', 'w', encoding='utf-8') as f:
    f.write(full_html)

with open('old-mountain-works(1).html', 'w', encoding='utf-8') as f:
    f.write(full_html)

downloads_path = r'C:\Users\anish jha\Downloads\old-mountain-works(1).html'
try:
    with open(downloads_path, 'w', encoding='utf-8') as f:
        f.write(full_html)
    print(f"Successfully copied to {downloads_path}")
except Exception as e:
    print(f"Notice: Failed to write to {downloads_path}: {e}")

print(f"Successfully assembled old-mountain-works.html and old-mountain-works(1).html: {len(full_html)} bytes.")
