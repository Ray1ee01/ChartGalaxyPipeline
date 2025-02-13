from serpapi import GoogleSearch
import pickle
import os
import urllib
import json
import re
import time
import socket

search_cache_path = './src/cache/search_cache'

class BaiduImageCrawler:
    # 睡眠时长
    __time_sleep = 0.1
    __amount = 0
    __start_amount = 0
    __counter = 0
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:23.0) Gecko/20100101 Firefox/23.0', 'Cookie': ''}
    __per_page = 30
    __timeout = 5
    socket.setdefaulttimeout(__timeout)
    
    # 获取图片url内容等
    # t 下载图片时间间隔
    def __init__(self, t=0.1):
        self.time_sleep = t
        self.urls = []
    # 获取后缀名
    @staticmethod
    def get_suffix(name):
        m = re.search(r'\.[^\.]*$', name)
        if m.group(0) and len(m.group(0)) <= 5:
            return m.group(0)
        else:
            return '.jpeg'

    @staticmethod
    def handle_baidu_cookie(original_cookie, cookies):
        """
        :param string original_cookie:
        :param list cookies:
        :return string:
        """
        if not cookies:
            return original_cookie
        result = original_cookie
        for cookie in cookies:
            result += cookie.split(';')[0] + ';'
        result.rstrip(';')
        return result

    # 保存图片
    def save_image(self, rsp_data, word):
        if not os.path.exists(os.path.join(search_cache_path, word)):
            os.makedirs(os.path.join(search_cache_path, word))
        # 判断名字是否重复，获取图片长度
        self.__counter = len(os.listdir(os.path.join(search_cache_path, word))) + 1
        for image_info in rsp_data['data']:
            try:
                if 'replaceUrl' not in image_info or len(image_info['replaceUrl']) < 1:
                    continue
                obj_url = image_info['replaceUrl'][0]['ObjUrl']
                thumb_url = image_info['thumbURL']
                url = 'https://image.baidu.com/search/down?tn=download&ipn=dwnl&word=download&ie=utf8&fr=result&url=%s&thumburl=%s' % (urllib.parse.quote(obj_url), urllib.parse.quote(thumb_url))
                time.sleep(self.time_sleep)
                suffix = self.get_suffix(obj_url)
                # 指定UA和referrer，减少403
                opener = urllib.request.build_opener()
                opener.addheaders = [
                    ('User-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36'),
                ]
                urllib.request.install_opener(opener)
                # 保存图片
                filepath = os.path.join(search_cache_path, word, str(self.__counter) + str(suffix))
                urllib.request.urlretrieve(url, filepath)
                if os.path.getsize(filepath) < 5:
                    print("下载到了空文件，跳过!")
                    os.unlink(filepath)
                    continue
                self.urls.append(filepath)
            except urllib.error.HTTPError as urllib_err:
                print(urllib_err)
                continue
            except Exception as err:
                time.sleep(1)
                print(err)
                print("产生未知错误，放弃保存")
                continue
            else:
                self.__counter += 1
        return

    # 开始获取
    def get_images(self, word):
        search = urllib.parse.quote(word)
        # pn int 图片数
        pn = self.__start_amount
        while pn < self.__amount:
            url = 'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ct=201326592&is=&fp=result&queryWord=%s&cl=2&lm=-1&ie=utf-8&oe=utf-8&adpicid=&st=-1&z=&ic=&hd=&latest=&copyright=&word=%s&s=&se=&tab=&width=&height=&face=0&istype=2&qc=&nc=1&fr=&expermode=&force=&pn=%s&rn=%d&gsm=1e&1594447993172=' % (search, search, str(pn), self.__per_page)
            # 设置header防403
            try:
                time.sleep(self.time_sleep)
                req = urllib.request.Request(url=url, headers=self.headers)
                page = urllib.request.urlopen(req)
                self.headers['Cookie'] = self.handle_baidu_cookie(self.headers['Cookie'], page.info().get_all('Set-Cookie'))
                rsp = page.read()
                page.close()
            except UnicodeDecodeError as e:
                print(e)
                print('-----UnicodeDecodeErrorurl:', url)
            except urllib.error.URLError as e:
                print(e)
                print("-----urlErrorurl:", url)
            except socket.timeout as e:
                print(e)
                print("-----socket timout:", url)
            else:
                # 解析json
                rsp = rsp.decode('utf-8').replace(r"\'", "'")
                rsp_data = json.loads(rsp, strict=False)
                if 'data' not in rsp_data:
                    pass
                else:
                    self.save_image(rsp_data, word)
                    pn += self.__per_page
        print(f"下载结束，下载数量：{self.__counter}")
        return

    def start(self, word, total_page=1, start_page=1, per_page=30):
        """
        爬虫入口
        :param word: 抓取的关键词
        :param total_page: 需要抓取数据页数 总抓取图片数量为 页数 x per_page
        :param start_page:起始页码
        :param per_page: 每页数量
        :return:
        """
        self.__per_page = per_page
        self.__start_amount = (start_page - 1) * self.__per_page
        self.__amount = total_page * self.__per_page + self.__start_amount
        self.get_images(word)
        urls = self.urls[:]
        self.urls.clear()
        return urls


def search_image(query, num=10, engine='google'):
    # 在当前基础上再爬取num张图片
    if engine == 'google':
        file_name = query.replace(' ', '_') + '.pkl'
        if not os.path.exists(search_cache_path):
            os.makedirs(search_cache_path)
        cache_path = os.path.join(search_cache_path, file_name)
        if os.path.exists(cache_path):
            with open(cache_path, 'rb') as f:
                result = pickle.load(f)
            return [result['images_results'][0]['original']]

        search = GoogleSearch({
            "engine": "google_images",
            "q": "'{}' clipart".format(query), 
            "api_key": "a3ddb646e3c8500f8c3c09c9d7025127e53f0ba5e4efd9a213211a49bee80646"
        })
        result = search.get_dict()
        with open(cache_path, 'wb') as f:
            pickle.dump(result, f)
        return [result['images_results'][0]['original']]
    elif engine == 'baidu':
        cur_results = []
        if os.path.exists(os.path.join(search_cache_path, query)):
            cur_results = [os.path.join(search_cache_path, query, file) for file in os.listdir(os.path.join(search_cache_path, query))]
        cur_num = len(cur_results)
        start_page = (cur_num - 1 + 2 * num) // num
        # if len(results) >= num:
        #     return results
        crawler = BaiduImageCrawler()
        results = crawler.start(query, total_page=1, start_page=start_page, per_page=num)
        return results

