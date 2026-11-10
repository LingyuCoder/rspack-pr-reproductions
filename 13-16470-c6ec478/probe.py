"""Instrument lifecycle only. Never hold map bytes or an extra Source reference at the observation point."""
from pathlib import Path
import sys
root=Path(sys.argv[1])
p=root/'crates/rspack_sources/src/source.rs'
s=p.read_text()
needle='    let parsed = (tape, Bytes::from_owner(bytes));'
new='''    let owner = if let Ok(dir) = std::env::var("RSPACK_OBSERVE_MAP") {
      struct Observed(Vec<u8>, std::path::PathBuf);
      impl AsRef<[u8]> for Observed {
        fn as_ref(&self) -> &[u8] { &self.0 }
      }
      impl Drop for Observed {
        fn drop(&mut self) {
          let _ = std::fs::write(&self.1, "dropped");
        }
      }
      let start = bytes.as_ptr() as usize;
      let length = bytes.len();
      let dir = std::path::Path::new(&dir);
      let marker = dir.join(format!("owner-{start}-{length}"));
      // A second owner may reuse an address after Drop; never overwrite its marker.
      let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(&marker).unwrap();
      std::io::Write::write_all(&mut file, b"alive").unwrap();
      Bytes::from_owner(Observed(bytes, marker))
    } else {
      Bytes::from_owner(bytes)
    };
    let parsed = (tape, owner);'''
assert s.count(needle)==1
p.write_text(s.replace(needle,new))
p=root/'crates/rspack_plugin_devtool/src/source_map_dev_tool_plugin.rs'
s=p.read_text()
needle='              let source_references = compute_source_references(compilation, &source_map);'
new='''              if asset_filename.ends_with("vendor.js") {
                if let Ok(dir) = std::env::var("RSPACK_OBSERVE_MAP") {
                  let dir = std::path::PathBuf::from(dir);
                  let sample = source_map.sources_content().iter().flatten().max_by_key(|s|s.len()).unwrap();
                  let address = sample.as_ptr() as usize;
                  let sample_len = sample.len();
                  let (marker, allocation_len) = std::fs::read_dir(&dir).unwrap().flatten().find_map(|file| {
                    let name = file.file_name(); let name = name.to_str()?;
                    let (start, len) = name.strip_prefix("owner-")?.split_once('-')?;
                    let start: usize = start.parse().ok()?; let len: usize = len.parse().ok()?;
                    (start <= address && address + sample_len <= start + len && std::fs::read_to_string(file.path()).ok()?.as_str() == "alive").then(|| (file.path(),len))
                  }).expect("sample must belong to a tracked live allocation");
                  let weak = std::sync::Arc::downgrade(&source);
                  std::thread::spawn(move || {
                    for _ in 0..2000 {
                      if dir.join("observe").exists() {
                        let state = std::fs::read_to_string(&marker).unwrap();
                        std::fs::write(dir.join("observed"), format!("{} {sample_len} {allocation_len} {state}", weak.strong_count())).unwrap();
                        break;
                      }
                      std::thread::sleep(std::time::Duration::from_millis(10));
                    }
                  });
                }
              }
'''
assert s.count(needle)==2
p.write_text(s.replace(needle,new+needle))
