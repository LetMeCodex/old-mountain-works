import sys

with open(r'C:\Users\anish jha\.gemini\antigravity\scratch\old-mountain-works\extracted_game.js', 'r', encoding='utf-8') as f:
    code = f.read()

indent = 0
out = []
in_str = False
str_char = ''
i = 0
n = len(code)
while i < n:
    c = code[i]
    if in_str:
        out.append(c)
        if c == '\\':
            i += 1
            if i < n:
                out.append(code[i])
        elif c == str_char:
            in_str = False
    else:
        if c in ('"', "'", '`'):
            in_str = True
            str_char = c
            out.append(c)
        elif c == '{':
            indent += 1
            out.append(' {\n' + '  ' * indent)
        elif c == '}':
            indent = max(0, indent - 1)
            out.append('\n' + '  ' * indent + '}\n' + '  ' * indent)
        elif c == ';':
            out.append(';\n' + '  ' * indent)
        else:
            out.append(c)
    i += 1

formatted = ''.join(out)
with open(r'C:\Users\anish jha\.gemini\antigravity\scratch\old-mountain-works\extracted_game_formatted.js', 'w', encoding='utf-8') as f:
    f.write(formatted)
print('Wrote extracted_game_formatted.js, total lines:', formatted.count('\n'))
