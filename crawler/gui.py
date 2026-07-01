import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import json
import os
import threading
from PIL import Image, ImageTk
from xiaohongshu import XiaohongshuCrawler
from recipe_importer import RecipeImporter
from config import DATA_DIR, DEFAULT_KEYWORD, DEFAULT_COUNT

class RecipeCrawlerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("小红书菜谱爬虫工具")
        self.root.geometry("1000x700")

        self.recipes = []
        self.selected_recipes = []
        self.crawler = XiaohongshuCrawler()
        self.importer = RecipeImporter()
        self.cache_file = None

        self._setup_ui()
        self._check_webbidge_status()

    def _setup_ui(self):
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        status_frame = ttk.Frame(main_frame)
        status_frame.pack(fill=tk.X, pady=5)

        self.webbidge_status_var = tk.StringVar(value="检查中...")
        self.webbidge_status_label = ttk.Label(status_frame, textvariable=self.webbidge_status_var)
        self.webbidge_status_label.pack(side=tk.LEFT)

        ttk.Label(status_frame, text="|").pack(side=tk.LEFT, padx=5)

        self.ai_status_var = tk.StringVar(value="AI: 就绪")
        ttk.Label(status_frame, textvariable=self.ai_status_var).pack(side=tk.LEFT)

        control_frame = ttk.LabelFrame(main_frame, text="爬取设置")
        control_frame.pack(fill=tk.X, pady=5)

        ttk.Label(control_frame, text="搜索关键词:").grid(row=0, column=0, padx=5, pady=5, sticky=tk.W)
        self.keyword_var = tk.StringVar(value=DEFAULT_KEYWORD)
        ttk.Entry(control_frame, textvariable=self.keyword_var, width=30).grid(row=0, column=1, padx=5, pady=5)

        ttk.Label(control_frame, text="数量:").grid(row=0, column=2, padx=5, pady=5, sticky=tk.W)
        self.count_var = tk.StringVar(value=str(DEFAULT_COUNT))
        ttk.Entry(control_frame, textvariable=self.count_var, width=10).grid(row=0, column=3, padx=5, pady=5)

        btn_frame = ttk.Frame(control_frame)
        btn_frame.grid(row=0, column=4, padx=10, pady=5)

        ttk.Button(btn_frame, text="开始爬取", command=self._start_crawl).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="加载本地缓存", command=self._load_local_cache).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="选择文件", command=self._load_local_file).pack(side=tk.LEFT, padx=5)

        progress_frame = ttk.LabelFrame(main_frame, text="进度")
        progress_frame.pack(fill=tk.X, pady=5)

        self.progress_var = tk.StringVar(value="就绪")
        ttk.Label(progress_frame, textvariable=self.progress_var).pack(side=tk.LEFT, padx=10)

        self.progress_bar = ttk.Progressbar(progress_frame, orient=tk.HORIZONTAL, length=400, mode='determinate')
        self.progress_bar.pack(side=tk.RIGHT, padx=10, fill=tk.X, expand=True)

        list_frame = ttk.LabelFrame(main_frame, text="菜谱列表")
        list_frame.pack(fill=tk.BOTH, expand=True, pady=5)

        canvas = tk.Canvas(list_frame)
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=canvas.yview)
        self.scrollable_frame = ttk.Frame(canvas)

        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        action_frame = ttk.LabelFrame(main_frame, text="操作")
        action_frame.pack(fill=tk.X, pady=5)

        ttk.Button(action_frame, text="全选", command=self._select_all).pack(side=tk.LEFT, padx=5)
        ttk.Button(action_frame, text="取消全选", command=self._deselect_all).pack(side=tk.LEFT, padx=5)
        ttk.Button(action_frame, text="批量导入系统菜谱", command=self._start_import).pack(side=tk.RIGHT, padx=5)

    def _check_webbidge_status(self):
        if self.crawler.is_webbidge_available():
            self.webbidge_status_var.set("WebBridge: ✅ 已连接")
            self.webbidge_status_label.config(foreground='green')
        else:
            self.webbidge_status_var.set("WebBridge: ❌ 未启动")
            self.webbidge_status_label.config(foreground='red')

    def _update_progress(self, text, value=0):
        self.progress_var.set(text)
        self.progress_bar["value"] = value
        self.root.update_idletasks()

    def _start_crawl(self):
        self._check_webbidge_status()
        
        if not self.crawler.is_webbidge_available():
            messagebox.showwarning(
                "WebBridge 未启动",
                "请先在 Kimi 中开启 WebBridge 服务，然后重新运行。\n\n"
                "开启方式：在 Kimi 中输入 '/webbidge start' 或在设置中开启。\n"
                "默认端口：28080"
            )
            return

        keyword = self.keyword_var.get().strip()
        try:
            count = int(self.count_var.get())
        except ValueError:
            messagebox.showerror("错误", "数量必须是数字")
            return

        if not keyword:
            messagebox.showerror("错误", "请输入搜索关键词")
            return

        self._update_progress("正在连接浏览器...")
        
        def crawl_thread():
            try:
                result = self.crawler.crawl(keyword, count)
                
                if result.get('success'):
                    self.recipes = result['data']
                    self.cache_file = result.get('cache_file')
                    self._update_progress(f"爬取完成，共 {len(self.recipes)} 个菜谱", 100)
                    self._display_recipes()
                else:
                    msg = result.get('message', '未知错误')
                    hint = result.get('hint', '')
                    error_msg = msg + ('\n\n提示: ' + hint if hint else '')
                    messagebox.showerror("爬取失败", error_msg)
                    self._update_progress("爬取失败")
            except Exception as e:
                messagebox.showerror("错误", str(e))
                self._update_progress("错误")

        threading.Thread(target=crawl_thread, daemon=True).start()

    def _load_local_cache(self):
        result = self.crawler.load_cached_recipes()
        
        if result.get('success'):
            self.recipes = result['data']
            self.cache_file = result.get('cache_file')
            self._update_progress(f"加载完成，共 {len(self.recipes)} 个菜谱", 100)
            self._display_recipes()
        else:
            messagebox.showwarning("提示", result.get('message', '没有找到缓存文件'))

    def _load_local_file(self):
        file_path = filedialog.askopenfilename(
            initialdir=DATA_DIR,
            title="选择菜谱文件",
            filetypes=[("JSON文件", "*.json")]
        )
        
        if file_path:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    self.recipes = json.load(f)
                
                self.cache_file = file_path
                self._update_progress(f"加载完成，共 {len(self.recipes)} 个菜谱", 100)
                self._display_recipes()
            except Exception as e:
                messagebox.showerror("错误", f"加载文件失败: {str(e)}")

    def _display_recipes(self):
        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()

        self.selected_recipes = []
        
        for i, recipe in enumerate(self.recipes):
            row_frame = ttk.Frame(self.scrollable_frame)
            row_frame.pack(fill=tk.X, pady=5, padx=5)

            var = tk.BooleanVar()
            ttk.Checkbutton(row_frame, variable=var).pack(side=tk.LEFT, padx=5)
            var.trace_add('write', lambda *args, v=var, idx=i: self._on_select(v, idx))

            try:
                img = Image.open(recipe['image_path'])
                img = img.resize((100, 100), Image.LANCZOS)
                photo = ImageTk.PhotoImage(img)
                label_img = ttk.Label(row_frame, image=photo)
                label_img.image = photo
                label_img.pack(side=tk.LEFT, padx=5)
            except Exception:
                ttk.Label(row_frame, text="图片加载失败").pack(side=tk.LEFT, padx=5)

            info_frame = ttk.Frame(row_frame)
            info_frame.pack(side=tk.LEFT, fill=tk.X, expand=True)

            ttk.Label(info_frame, text=recipe['title'], font=('Helvetica', 10, 'bold')).pack(anchor=tk.W)
            ttk.Label(info_frame, text=recipe['image_path'], font=('Helvetica', 8), foreground='gray').pack(anchor=tk.W)
            
            if recipe.get('link'):
                ttk.Label(info_frame, text=f"来源: {recipe['link'][:50]}...", font=('Helvetica', 8), foreground='blue').pack(anchor=tk.W)

    def _on_select(self, var, idx):
        if var.get():
            if idx not in self.selected_recipes:
                self.selected_recipes.append(idx)
        else:
            if idx in self.selected_recipes:
                self.selected_recipes.remove(idx)

    def _select_all(self):
        for widget in self.scrollable_frame.winfo_children():
            if isinstance(widget, ttk.Frame):
                children = widget.winfo_children()
                if children and isinstance(children[0], ttk.Checkbutton):
                    children[0].state(['selected'])

    def _deselect_all(self):
        for widget in self.scrollable_frame.winfo_children():
            if isinstance(widget, ttk.Frame):
                children = widget.winfo_children()
                if children and isinstance(children[0], ttk.Checkbutton):
                    children[0].state(['!selected'])

    def _start_import(self):
        selected_data = [self.recipes[idx] for idx in self.selected_recipes]
        
        if not selected_data:
            messagebox.showwarning("提示", "请先选择要导入的菜谱")
            return

        confirm = messagebox.askyesno(
            "确认导入",
            f"确定要导入 {len(selected_data)} 个菜谱到系统菜谱库吗？\n\n"
            "导入过程中会调用AI识别每张图片，请确保网络畅通。"
        )

        if not confirm:
            return

        self._update_progress("开始批量导入...")
        
        def import_thread():
            try:
                def on_progress(idx, total, title, status, progress):
                    self._update_progress(f"[{idx+1}/{total}] {title} - {status}", progress)

                result = self.importer.import_recipes(selected_data, on_progress)
                
                if result.get('success'):
                    success = result['success_count']
                    total = result['total']
                    messagebox.showinfo(
                        "导入完成",
                        f"批量导入完成！\n成功: {success}/{total}\n失败: {total-success}/{total}"
                    )
                    self._update_progress("导入完成")
                else:
                    messagebox.showerror("导入失败", result.get('error', '未知错误'))
                    self._update_progress("导入失败")
            except Exception as e:
                messagebox.showerror("错误", str(e))
                self._update_progress("错误")

        threading.Thread(target=import_thread, daemon=True).start()

def main():
    root = tk.Tk()
    app = RecipeCrawlerGUI(root)
    root.mainloop()

if __name__ == '__main__':
    main()