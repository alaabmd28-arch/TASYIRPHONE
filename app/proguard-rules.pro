# واجهة الجسر بين الجافاسكربت والكوتلن يجب أن تبقى بأسمائها
-keepclassmembers class com.mycompany.tasyirbmd.MainActivity$Bridge { @android.webkit.JavascriptInterface <methods>; }
-keepattributes JavascriptInterface
# أسطر الأخطاء تبقى مفهومة في تقارير الانهيار بعد التعتيم
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
