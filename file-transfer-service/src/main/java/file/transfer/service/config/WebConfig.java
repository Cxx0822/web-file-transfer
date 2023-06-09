package file.transfer.service.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    // 配置跨域请求
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("*")
                .allowedHeaders("*")
                .allowedMethods("*");
    }

    // 本地路径
    private static final String locationPath = "/home/cxx/Downloads/";
    // 映射路径 例http://Ip:Port/downloads/***.***
    private static final String webPath = "/downloads/**";

    // 将本地文件映射到Url 可以直接下载
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler(webPath).addResourceLocations("file:" + locationPath);
    }
}