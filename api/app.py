from flask import Flask, request, Response
from flask_cors import CORS
from response_stream import response_stream

app = Flask(__name__)
CORS(app)


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    if not data or not data.get("content"):
        return "Error: no content provided", 400

    content = data["content"]
    use_wikipedia_tool = data.get("use_wikipedia_tool", False)

    return Response(
        response_stream(content, use_wikipedia_tool),
        mimetype="text/event-stream",
        headers={
            "Connection": "keep-alive",
            "Cache-Control": "no-cache",
        },
    )


if __name__ == "__main__":
    app.run(
        port=3333,
    )
