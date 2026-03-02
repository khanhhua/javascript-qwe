import csv
import random
import signal
import sys

words = []

def on_sigterm(signum, frame):
    print("\n==== REPORT ====")
    for word in words:
        print("{word:10} {meaning:10} {correct}".format(**word))
    print("==== END ====")

    print("BYE!")
    sys.exit(0)

signal.signal(signal.SIGINT, on_sigterm)

with open("words.csv") as file:
    reader = csv.DictReader(file, delimiter=";", quotechar="\"")
    words = [dict(**row, correct=0) for row in reader]

print("CTRL_C to exit")
while True:
    selected = random.choice(words)
    answer = input(f"{selected["word"]}:")

    correct = answer == selected["meaning"]
    if correct:
        selected["correct"] += 1

    msg = 'CORRECT!' if correct else 'WRONG :('
    print(f"{msg} {selected['word']} means {selected['meaning']}")