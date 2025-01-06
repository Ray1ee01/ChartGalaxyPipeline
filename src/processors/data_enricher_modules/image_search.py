from serpapi import GoogleSearch
import pickle

search_cache_path = '/data1/jiashu/ChartPipeline/search_cache'

def search_image(query):
    file_name = query.replace(' ', '_') + '.pkl'
    if not os.path.exists(search_cache_path):
        os.makedirs(search_cache_path)
    cache_path = os.path.join(search_cache_path, file_name)
    if os.path.exists(cache_path):
        with open(cache_path, 'rb') as f:
            result = pickle.load(f)
        return result

    search = GoogleSearch({
        "engine": "google_images",
        "q": "'{}' clipart".format(query), 
        "api_key": "a3ddb646e3c8500f8c3c09c9d7025127e53f0ba5e4efd9a213211a49bee80646"
    })
    result = search.get_dict()
    with open(cache_path, 'wb') as f:
        pickle.dump(result, f)
    return result