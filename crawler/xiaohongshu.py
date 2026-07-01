import requests
import json
import os
import time
import uuid
import urllib.parse
import re
import subprocess
from config import KIMI_WEBBIDGE_URL, IMAGE_DIR, DATA_DIR

class XiaohongshuCrawler:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.xiaohongshu.com/',
            'Accept': 'application/json, text/plain, */*'
        })
        self._check_webbidge_status()

    def _check_webbidge_status(self):
        try:
            cmd = ['d:\\Working\\小程序\\.kimi-webbridge\\bin\\kimi-webbridge.exe', 'status']
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                output = result.stdout.strip()
                if 'running' in output.lower() and 'true' in output.lower():
                    print('Kimi WebBridge 状态: 运行中')
                    return True
                else:
                    print('Kimi WebBridge 状态: 未连接')
                    return False
            else:
                print('Kimi WebBridge 状态: 未启动')
                return False
        except Exception as e:
            print(f'Kimi WebBridge 检查失败: {e}')
            return False

    def is_webbidge_available(self):
        return self._check_webbidge_status()

    def _run_webbidge_cmd(self, action, args=None):
        cmd = ['d:\\Working\\小程序\\.kimi-webbridge\\bin\\kimi-webbridge.exe', action]
        if args:
            cmd.append(json.dumps(args))
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                output = result.stdout.strip()
                try:
                    return json.loads(output)
                except json.JSONDecodeError:
                    return {'success': True, 'result': output}
            else:
                return {'success': False, 'error': result.stderr[:200]}
        except subprocess.TimeoutExpired:
            return {'success': False, 'error': '命令超时'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def navigate(self, url):
        return self._run_webbidge_cmd('navigate', {'url': url})

    def evaluate(self, code):
        return self._run_webbidge_cmd('evaluate', {'code': code})

    def click(self, selector):
        return self._run_webbidge_cmd('click', {'selector': selector})

    def screenshot(self, format='png'):
        return self._run_webbidge_cmd('screenshot', {'format': format})

    def wait_for(self, selector, timeout=10):
        script = f"""
        (function() {{
            var el = document.querySelector('{selector}');
            return !!el;
        }})()
        """
        for _ in range(timeout):
            result = self.evaluate(script)
            if result.get('success') and result.get('result'):
                return True
            time.sleep(1)
        return False

    def scroll_down(self, times=3):
        for _ in range(times):
            self.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(2)

    def search_recipes(self, keyword='家常菜', count=10):
        search_url = f"https://www.xiaohongshu.com/search_result?keyword={urllib.parse.quote(keyword)}"
        
        result = self.navigate(search_url)
        if not result.get('success'):
            return {'success': False, 'message': '导航失败', 'error': result.get('error')}

        time.sleep(3)

        if not self.wait_for('.note-card', timeout=15):
            return {'success': False, 'message': '页面加载超时'}

        self.scroll_down(times=2)

        extract_script = """
        (function() {
            var cards = document.querySelectorAll('.note-card');
            var results = [];
            cards.forEach(function(card) {
                var title = '';
                var imgUrl = '';
                var link = '';
                
                var titleEl = card.querySelector('.note-title') || card.querySelector('.title') || card.querySelector('h3');
                if (titleEl) title = titleEl.textContent.trim();
                
                var imgEl = card.querySelector('img');
                if (imgEl) {
                    imgUrl = imgEl.src || imgEl.dataset.src || imgEl.getAttribute('data-src');
                    if (!imgUrl) imgUrl = imgEl.getAttribute('src');
                }
                
                var linkEl = card.querySelector('a');
                if (linkEl) link = linkEl.href;
                
                if (title && imgUrl) {
                    results.push({title: title, image_url: imgUrl, link: link});
                }
            });
            return results;
        })()
        """

        result = self.evaluate(extract_script)
        if not result.get('success'):
            return {'success': False, 'message': '提取数据失败', 'error': result.get('error')}

        recipes = result.get('result', [])[:count]
        return {'success': True, 'data': recipes}

    def download_image(self, url, filename=None):
        try:
            if not filename:
                filename = str(uuid.uuid4()) + '.jpg'
            filepath = os.path.join(IMAGE_DIR, filename)
            
            img_session = requests.Session()
            img_session.headers.update({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.xiaohongshu.com/'
            })
            
            resp = img_session.get(url, timeout=20)
            if resp.status_code == 200:
                with open(filepath, 'wb') as f:
                    f.write(resp.content)
                return {'success': True, 'filepath': filepath}
            return {'success': False, 'error': f"HTTP {resp.status_code}"}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def crawl(self, keyword='家常菜', count=10):
        print(f"开始爬取小红书菜谱: {keyword}, 数量: {count}")
        
        if not self.is_webbidge_available():
            return {
                'success': False, 
                'message': 'Kimi WebBridge 未启动或未连接',
                'error': '请先启动 Kimi WebBridge 服务并安装浏览器扩展',
                'hint': '1. 安装 Chrome/Edge 浏览器扩展\n2. 运行 kimi-webbridge.exe start\n3. 在浏览器中确保扩展已连接'
            }
        
        search_result = self.search_recipes(keyword, count)
        if not search_result.get('success'):
            return search_result

        recipes = search_result['data']
        saved_recipes = []

        for i, recipe in enumerate(recipes):
            print(f"正在处理 [{i+1}/{len(recipes)}]: {recipe['title']}")
            
            img_result = self.download_image(recipe['image_url'])
            if img_result.get('success'):
                saved_recipes.append({
                    'title': recipe['title'],
                    'image_path': img_result['filepath'],
                    'image_url': recipe['image_url'],
                    'link': recipe.get('link', '')
                })
            else:
                print(f"  下载图片失败: {img_result.get('error')}")

        cache_file = os.path.join(DATA_DIR, f"recipes_{int(time.time())}.json")
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(saved_recipes, f, ensure_ascii=False, indent=2)

        print(f"爬取完成！共获取 {len(saved_recipes)} 个菜谱，已保存到 {cache_file}")
        return {'success': True, 'data': saved_recipes, 'cache_file': cache_file}

    def load_cached_recipes(self, cache_file=None):
        if not cache_file:
            cache_files = sorted([f for f in os.listdir(DATA_DIR) if f.startswith('recipes_')], reverse=True)
            if not cache_files:
                return {'success': False, 'message': '没有找到缓存文件'}
            cache_file = os.path.join(DATA_DIR, cache_files[0])
        
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                recipes = json.load(f)
            return {'success': True, 'data': recipes, 'cache_file': cache_file}
        except Exception as e:
            return {'success': False, 'message': '加载缓存失败', 'error': str(e)}

if __name__ == '__main__':
    crawler = XiaohongshuCrawler()
    print('WebBridge 可用:', crawler.is_webbidge_available())
    if crawler.is_webbidge_available():
        result = crawler.crawl('家常菜', 3)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print('请先启动 Kimi WebBridge')