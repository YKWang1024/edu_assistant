import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
IMAGE_DIR = os.path.join(DATA_DIR, 'images')
CACHE_DIR = os.path.join(DATA_DIR, 'cache')

for dir_path in [DATA_DIR, IMAGE_DIR, CACHE_DIR]:
    os.makedirs(dir_path, exist_ok=True)

DEFAULT_KEYWORD = '家常菜'
DEFAULT_COUNT = 10

KIMI_WEBBIDGE_URL = 'http://localhost:10086'

CLOUDBASE_ENV_ID = 'cloud1-d0gnc8vm2aae15ae5'

RECIPE_COLLECTIONS = ['荤菜', '素菜', '汤类', '主食', '水果', '其他']
MEAL_TIMES = ['早餐', '中餐', '晚餐']