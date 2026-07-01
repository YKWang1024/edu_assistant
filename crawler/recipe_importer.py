import requests
import json
import base64
import os
import time
import subprocess
import sys
from config import CLOUDBASE_ENV_ID, IMAGE_DIR

CLOUDBASE_FUNCTION_URL = f"https://{CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1"

class RecipeImporter:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
        })

    def _encode_image(self, image_path):
        try:
            with open(image_path, 'rb') as f:
                return base64.b64encode(f.read()).decode('utf-8')
        except Exception as e:
            return None

    def call_cloud_function(self, function_name, data):
        import shutil
        tcb_path = shutil.which('tcb')
        if not tcb_path:
            tcb_path = 'C:\\Users\\86185\\AppData\\Roaming\\npm\\tcb.cmd'
        
        cmd = [
            tcb_path, 'fn', 'invoke',
            '-e', CLOUDBASE_ENV_ID,
            function_name,
            '--json'
        ]
        
        try:
            result = subprocess.run(
                cmd,
                input=json.dumps(data, ensure_ascii=False),
                capture_output=True,
                text=True,
                encoding='utf-8',
                timeout=60
            )
            
            if result.returncode == 0:
                try:
                    output = result.stdout.strip()
                    if output:
                        parsed = json.loads(output)
                        if parsed.get('data') and parsed['data'].get('RetMsg'):
                            try:
                                return json.loads(parsed['data']['RetMsg'])
                            except json.JSONDecodeError:
                                return parsed
                        return parsed
                    return {'success': False, 'error': '云函数无输出'}
                except json.JSONDecodeError:
                    return {'success': False, 'error': f'JSON解析失败: {result.stdout[:200]}'}
            else:
                error_msg = result.stderr[:200] if result.stderr else result.stdout[:200]
                return {'success': False, 'error': f"调用失败(exit code {result.returncode}): {error_msg}"}
        except subprocess.TimeoutExpired:
            return {'success': False, 'error': '调用超时'}
        except FileNotFoundError:
            return {'success': False, 'error': '未找到 tcb CLI，请先安装: npm install -g @cloudbase/cli'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def recognize_recipe(self, image_path, title_hint=''):
        base64_img = self._encode_image(image_path)
        if not base64_img:
            return {'success': False, 'error': '图片编码失败'}

        prompt = f"""你是家常菜谱助手。请根据这张菜品照片{"（菜名提示：" + title_hint + "）" if title_hint else ""}识别这道菜，并【只输出一个 JSON 对象】，不要输出多余文字、解释、Markdown 代码块或反引号。字段：
{{
  "name": 菜名,
  "category": 分类，只能是以下之一：["荤菜", "素菜", "汤类", "主食", "水果", "其他"],
  "ingredients": 主要食材(字符串，用「、」分隔),
  "steps": 简明做法步骤(字符串，可用换行分隔每步),
  "tags": 标签(字符串，如 下饭、家常、快手),
  "nutrition": 一句话营养简评(字符串),
  "calories": {{"calories": 每份估算热量(千卡，数字), "protein": 蛋白质克数, "fat": 脂肪克数, "carbs": 碳水克数}}
}}
若无法判断热量则给出合理估算。"""

        result = self.call_cloud_function('aiVision', {
            'image': base64_img,
            'prompt': prompt,
            'mediaType': 'image/jpeg',
            'debug': False
        })

        if not result.get('success'):
            return result

        text = result.get('text', '')
        if not text:
            return {'success': False, 'error': 'AI未返回内容'}

        try:
            json_str = text.strip()
            if json_str.startswith('```json'):
                json_str = json_str[7:-3]
            elif json_str.startswith('```'):
                json_str = json_str[3:-3]
            recipe_data = json.loads(json_str)
            return {'success': True, 'data': recipe_data}
        except json.JSONDecodeError as e:
            return {'success': False, 'error': f'JSON解析失败: {str(e)}, 原始内容: {text[:200]}'}

    def save_system_recipe(self, recipe_data, image_path=None):
        recipe = {
            'name': recipe_data.get('name', ''),
            'ingredients': recipe_data.get('ingredients', ''),
            'steps': recipe_data.get('steps', ''),
            'category': recipe_data.get('category', '其他'),
            'tags': recipe_data.get('tags', ''),
            'nutrition': recipe_data.get('nutrition', ''),
            'calories': recipe_data.get('calories', None),
            'images': [],
            'referenceLink': recipe_data.get('referenceLink', ''),
            'referenceType': 'xiaohongshu',
            'referenceLabel': recipe_data.get('title', '')
        }

        if not recipe['name']:
            return {'success': False, 'error': '菜名不能为空'}

        result = self.call_cloud_function('saveSystemRecipe', recipe)
        return result

    def import_recipes(self, recipes, on_progress=None):
        results = []
        total = len(recipes)

        for i, recipe in enumerate(recipes):
            progress = (i + 1) / total * 100
            status = 'processing'
            error = None

            print(f"[{i+1}/{total}] 正在处理: {recipe['title']}")

            if on_progress:
                on_progress(i, total, recipe['title'], '识别中...', progress)

            rec_result = self.recognize_recipe(recipe['image_path'], recipe['title'])
            
            if rec_result.get('success'):
                recipe_data = rec_result['data']
                recipe_data['title'] = recipe['title']
                recipe_data['referenceLink'] = recipe.get('link', '')

                if on_progress:
                    on_progress(i, total, recipe['title'], '保存中...', progress)

                save_result = self.save_system_recipe(recipe_data)
                
                if save_result.get('success'):
                    status = 'success'
                    print(f"  导入成功: {recipe_data.get('name')}")
                else:
                    status = 'failed'
                    error = save_result.get('message') or '保存失败'
                    print(f"  保存失败: {error}")
            else:
                status = 'failed'
                error = rec_result.get('error') or '识别失败'
                print(f"  识别失败: {error}")

            results.append({
                'index': i,
                'title': recipe['title'],
                'image_path': recipe['image_path'],
                'status': status,
                'error': error,
                'recipe_data': rec_result.get('data') if rec_result.get('success') else None
            })

            time.sleep(1)

        success_count = sum(1 for r in results if r['status'] == 'success')
        print(f"\n批量导入完成！成功: {success_count}/{total}")
        return {'success': True, 'results': results, 'success_count': success_count, 'total': total}

    def import_from_file(self, json_file, on_progress=None):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                recipes = json.load(f)
            
            if not isinstance(recipes, list):
                return {'success': False, 'error': '无效的JSON格式'}

            return self.import_recipes(recipes, on_progress)
        except Exception as e:
            return {'success': False, 'error': str(e)}