from flask import Flask, render_template, request, jsonify
import subprocess
import os
import json

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, "input.txt")
OUTPUT_FILE = os.path.join(BASE_DIR, "output.txt")
C_SOURCE = os.path.join(BASE_DIR, "knapsack.c")
C_BINARY = os.path.join(BASE_DIR, "knapsack")

def compile_c():
    """Compile the C program if binary is missing or outdated."""
    if not os.path.exists(C_BINARY) or \
       os.path.getmtime(C_SOURCE) > os.path.getmtime(C_BINARY):
        result = subprocess.run(
            ["gcc", "-O2", "-o", C_BINARY, C_SOURCE],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            raise RuntimeError(f"Compilation failed:\n{result.stderr}")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/optimize", methods=["POST"])
def optimize():
    try:
        data = request.get_json()
        items = data.get("items", [])
        capacity = int(data.get("capacity", 0))

        if not items:
            return jsonify({"error": "No cargo items provided."}), 400
        if capacity <= 0:
            return jsonify({"error": "Vehicle capacity must be a positive number."}), 400

        # Write input.txt
        with open(INPUT_FILE, "w") as f:
            f.write(f"{len(items)} {capacity}\n")
            for item in items:
                name = item["name"].replace(" ", "_")
                weight = int(item["weight"])
                profit = int(item["profit"])
                f.write(f"{name} {weight} {profit}\n")

        # Compile if needed
        compile_c()

        # Run C program
        result = subprocess.run(
            [C_BINARY],
            capture_output=True, text=True, timeout=10,
            cwd=BASE_DIR
        )
        if result.returncode != 0:
            return jsonify({"error": f"C program error: {result.stderr}"}), 500

        # Read output.txt
        with open(OUTPUT_FILE, "r") as f:
            content = f.read().strip()

        lines = content.split("\n")
        max_profit = int(lines[0].split(":")[1].strip())
        total_weight = int(lines[1].split(":")[1].strip())
        selected_count = int(lines[2].split(":")[1].strip())

        selected_items = []
        for i in range(3, 3 + selected_count):
            parts = lines[i].split()
            selected_items.append({
                "name": parts[0].replace("_", " "),
                "weight": int(parts[1]),
                "profit": int(parts[2])
            })

        # Parse DP table if present
        dp_table = []
        if len(lines) > 3 + selected_count + 1:
            table_start = 3 + selected_count + 1
            for row_line in lines[table_start:]:
                if row_line.strip():
                    dp_table.append(list(map(int, row_line.strip().split())))

        return jsonify({
            "max_profit": max_profit,
            "total_weight": total_weight,
            "capacity": capacity,
            "selected_items": selected_items,
            "dp_table": dp_table,
            "total_items": len(items)
        })

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Optimization timed out."}), 500
    except FileNotFoundError:
        return jsonify({"error": "GCC compiler not found. Please install GCC."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
