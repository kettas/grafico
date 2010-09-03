require 'rubygems'

desc 'Packages Grafico'
task :package => [:require_compiler] do
  sources  = ['base', 'line', 'bar', 'spark']
  packaged = File.join(File.dirname(__FILE__), 'packaged', 'grafico.min.js')
  unpackagedsize = 0

  contents = sources.map do |source|
    file = File.join(File.dirname(__FILE__), 'source', "grafico.#{source}.js")
    unpackagedsize += File.size(file)
    File.read(file)
  end.join("\n")

  File.open(packaged, "w") do |f|
    puts "Unpackaged: " + (unpackagedsize/1000).to_s + "KB"
    f.write Closure::Compiler.new.compile(contents)
    puts "Packaged:   " + (File.size?(packaged)/1000).to_s + "KB (in " + packaged + ")"
  end
end

task :require_compiler do
  begin
    require 'closure-compiler'
  rescue LoadError
    puts "Install closure-compiler:"
    puts "sudo gem install closure-compiler --source http://gemcutter.org"
    abort
  end
end

