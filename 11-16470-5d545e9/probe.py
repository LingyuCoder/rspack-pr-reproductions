"""Test-only observer. Observe a Weak source and check whether the observer is the last owner of the generated input bytes."""
from pathlib import Path
import sys
p = Path(sys.argv[1]) / 'crates/rspack_plugin_swc_js_minimizer/src/lib.rs'
s = p.read_text()
anchor = '        original.set_source(Some(source));'
probe = r'''        if let Ok(dir) = std::env::var("RSPACK_MINIFIER_PROBE_DIR") {
          if let Some(mapped) = source.as_ref().as_any().downcast_ref::<SourceMapSource>() {
            let bytes: usize = mapped.source_map().sources_content().iter()
              .flatten().map(|s| s.len()).sum();
            let input = mapped.source_map().sources_content().iter().flatten().max_by_key(|s|s.len()).unwrap().clone().into_bytes();
            let generated = mapped.value().len();
            let weak = std::sync::Arc::downgrade(&source);
            std::thread::spawn(move || {
              let dir = std::path::PathBuf::from(dir);
              for _ in 0..12000 {
                if dir.join("after-emit").exists() {
                  let live = weak.strong_count() > 0;
                  std::fs::write(dir.join("measured"), format!("{live} {bytes} {generated} {}", input.is_unique())).unwrap();
                  return;
                }
                std::thread::sleep(std::time::Duration::from_millis(10));
              }
            });
          }
        }
'''
assert s.count(anchor) == 1
p.write_text(s.replace(anchor, probe + anchor))
