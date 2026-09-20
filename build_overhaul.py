# Generator script to build the complete overhaul of old-mountain-works.html
import os

with open('prefix.html', 'r', encoding='utf-8') as f:
    prefix = f.read()

# Let's inspect prefix
print('Prefix length:', len(prefix))
