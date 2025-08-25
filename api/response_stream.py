import cohere
import json
from dotenv import load_dotenv
from model import MODEL
from search_wikipedia import search_wikipedia


load_dotenv()

functions_map = {
    "search_wikipedia": search_wikipedia,
}

tools = [
    {
        "type": "function",
        "function": {
            "name": "search_wikipedia",
            "description": "Search Wikipedia for a query and return the full content of the top matching pages",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to find Wikipedia articles about, for example: 'Crypto', 'Barack Obama', 'NLP'",
                    }
                },
                "required": ["query"],
            },
        },
    },
]


def response_stream(content, use_wikipedia_tool=False):
    co = cohere.ClientV2()

    messages = [{"role": "user", "content": content}]

    initial_response = co.chat(
        model=MODEL,
        messages=messages,
        tools=tools if use_wikipedia_tool else [],
    )

    # If the model has generated tool calls, process them
    if initial_response.message.tool_calls:
        process_tool_calls(initial_response, messages)

    # Stream the final response with any tool results
    response = co.chat_stream(model=MODEL, messages=messages)

    try:
        for event in response:
            if event.type == "content-delta":
                # Format as SSE
                yield f"data: {event.delta.message.content.text}\n\n"

        # Signal completion
        yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: [ERROR]: {str(e)}\n\n"


def process_tool_calls(response, messages):
    messages.append(
        {
            "role": "assistant",
            "tool_calls": response.message.tool_calls,
            "tool_plan": response.message.tool_plan,
        }
    )

    for tc in response.message.tool_calls:
        args = json.loads(tc.function.arguments)
        tool_result = functions_map[tc.function.name](**args)

        tool_content = []
        for data in tool_result:
            tool_content.append(
                {
                    "type": "document",
                    "document": {"data": json.dumps(data)},
                }
            )

        messages.append(
            {
                "role": "tool",
                "tool_call_id": tc.id,
                "content": tool_content,
            }
        )
