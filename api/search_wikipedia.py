import requests


def search_wikipedia(query):
    try:
        search_url = "https://en.wikipedia.org/w/api.php"
        search_params = {
            "action": "query",
            "format": "json",
            "list": "search",
            "srsearch": query,
            "srprop": "snippet",
            "srlimit": 3,
        }

        search_response = requests.get(search_url, params=search_params)
        search_data = search_response.json()

        titles = [item["title"] for item in search_data["query"]["search"]]

        if not titles:
            return [{"error": "No valid titles found"}]

        content_params = {
            "action": "query",
            "format": "json",
            "titles": "|".join(titles),
            "exintro": False,
            "prop": "extracts",
            "explaintext": True,
            "exsectionformat": "plain",
        }

        content_response = requests.get(search_url, params=content_params)
        content_data = content_response.json()

        results = [
            {
                "title": page_data["title"],
                "content": page_data.get("extract") or "No content available",
            }
            for page_data in content_data["query"]["pages"].values()
        ]

        return results

    except Exception as e:
        return [{"error": f"Failed to search Wikipedia: {str(e)}"}]
