#!/usr/bin/fish

rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate.fish
.venv/bin/pip3 install -r requirements.txt
